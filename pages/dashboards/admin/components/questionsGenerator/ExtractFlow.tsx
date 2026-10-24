import React, { useEffect, useRef, useState } from 'react';
import { QGError, qgJson, sleep } from './api';
import { plainMath } from './MathText';
import ProviderPicker from './ProviderPicker';
import { PageResult, QGConfig, Question, RunResult, countQuestions } from './types';
import { Card, Checkbox, Label, Modal, Notice, PrimaryButton, ProgressBar, SecondaryButton, Select, TextArea, TextInput } from './ui';

interface SourcePage {
  doc_id: string;
  kind: 'pdf' | 'image';
  page_number: number | null;
  label: string;
  mode: 'text' | 'image';
  page_text: string | null;
  preview: string | null;
  mime?: string;
  subtopic: string;
}

interface ExtractResponse {
  label: string;
  questions: Question[];
  text_read: string | null;
  error: string | null;
  fatal: boolean;
}

interface ExtractedPage {
  label: string;
  subtopic: string;
  questions: Question[];
}

interface MissingItem {
  id: string;
  label: string;
  question: string;
  options: string[];
  question_type: string;
}

const MISSING_FLAG =
  'MISSING ANSWER KEY — the source did not show a visible answer for this question. Fill in the correct answer before use.';
const BLANK_FLAG = 'Answer intentionally left blank by the reviewer — verify before use.';

const ExtractFlow: React.FC<{ config: QGConfig; onDone: (result: RunResult) => void }> = ({ config, onDone }) => {
  const ocrMethod = config.extraction_methods.find((m) => m.value === 'ocr') || config.extraction_methods[0];
  const [method, setMethod] = useState<'ocr' | 'ai'>(ocrMethod?.value || 'ocr');
  const firstProvider = config.providers.find((p) => p.configured);
  const [provider, setProvider] = useState(firstProvider?.name || config.providers[0]?.name || '');
  const [model, setModel] = useState(firstProvider?.default_model || '');
  const [subject, setSubject] = useState(config.default_subject);
  const [grade, setGrade] = useState('11');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState(config.plain_difficulties[1] || config.plain_difficulties[0]);
  const [bloom, setBloom] = useState(config.bloom_levels[1] || config.bloom_levels[0]);

  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<SourcePage[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ value: 0, text: '' });
  const [messages, setMessages] = useState<{ kind: 'error' | 'warning' | 'info'; text: string; detail?: string }[]>([]);
  const [extracted, setExtracted] = useState<ExtractedPage[] | null>(null);
  const [ackBlank, setAckBlank] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const [pendingBuild, setPendingBuild] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const prepare = async (targets: File[], signal?: AbortSignal) => {
    const form = new FormData();
    targets.forEach((target) => form.append('files', target));
    return qgJson<{ pages: Omit<SourcePage, 'subtopic'>[]; source_name: string }>('/extract/prepare', { form, signal });
  };

  useEffect(() => {
    if (!files.length) return;
    const controller = new AbortController();
    setPreparing(true);
    setPrepareError(null);
    setExtracted(null);

    prepare(files, controller.signal)
      .then((data) => {
        setPages(data.pages.map((page) => ({ ...page, subtopic: '' })));
        setSourceName(data.source_name);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setPages([]);
        setPrepareError(error.message);
      })
      .finally(() => !controller.signal.aborted && setPreparing(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const providerReady =
    method === 'ocr' || Boolean(config.providers.find((p) => p.name === provider)?.configured && model.trim());
  const subtopicsReady = pages.length > 0 && pages.every((page) => page.subtopic.trim());

  const extract = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setMessages([]);
    const collected: ExtractedPage[] = [];
    let failed = 0;
    let current = pages;

    const call = (page: SourcePage) =>
      qgJson<ExtractResponse>('/extract/page', {
        signal: controller.signal,
        json: {
          doc_id: page.doc_id,
          kind: page.kind,
          page_number: page.page_number,
          label: page.label,
          mode: page.mode,
          mime: page.mime,
          method,
          provider: method === 'ai' ? provider : null,
          model: method === 'ai' ? model.trim() : null,
          difficulty,
          bloom_level: bloom,
        },
      });

    try {
      for (let index = 0; index < current.length; index++) {
        const page = current[index];
        setProgress({
          value: index / current.length,
          text:
            method === 'ocr'
              ? `Reading ${page.label} (${index + 1} of ${current.length}) with built-in OCR...`
              : `Extracting ${page.label} (${index + 1} of ${current.length}) — waiting for the AI's reply...`,
        });

        let response: ExtractResponse;
        try {
          response = await call(page);
        } catch (error: any) {
          if (error instanceof QGError && error.status === 409) {
            // The server forgot the uploads: send them again and continue.
            const fresh = await prepare(files, controller.signal);
            current = current.map((old) => {
              const match = fresh.pages.find((p) => p.label === old.label);
              return match ? { ...old, doc_id: match.doc_id } : old;
            });
            response = await call(current[index]);
          } else {
            throw error;
          }
        }

        if (response.error) {
          failed++;
          setMessages((previous) => [...previous, { kind: 'error', text: response.error! }]);
          if (response.fatal) break;
          continue;
        }

        if (!response.questions.length) {
          failed++;
          setMessages((previous) => [
            ...previous,
            method === 'ocr'
              ? {
                  kind: 'warning',
                  text: `No numbered questions were recognised on ${page.label}. If the text read (below) looks right, the layout is unusual (try the AI method); if it looks garbled, try a sharper image.`,
                  detail: response.text_read || '(no text found)',
                }
              : { kind: 'warning', text: `No questions were found on ${page.label}.` },
          ]);
          continue;
        }

        collected.push({ label: page.label, subtopic: page.subtopic.trim(), questions: response.questions });
        if (method === 'ai' && index < current.length - 1) await sleep(config.min_request_delay * 1000, controller.signal);
      }
    } catch (error: any) {
      setMessages((previous) => [...previous, { kind: 'error', text: error?.name === 'AbortError' ? 'Extraction stopped.' : error.message }]);
    }

    setProgress({ value: 1, text: 'Extraction finished.' });
    setRunning(false);

    if (!countQuestions(collected)) {
      if (!failed) {
        setMessages((previous) => [
          ...previous,
          { kind: 'error', text: 'No questions were found in the uploaded file(s). Check the images are clear and contain questions, then try again.' },
        ]);
      }
      return;
    }

    if (collected.length < current.length) {
      setMessages((previous) => [
        ...previous,
        { kind: 'warning', text: `Extracted ${collected.length} of ${current.length} page(s); the rest can be re-tried by extracting again.` },
      ]);
    }

    setAckBlank({});
    setExtracted(collected);
  };

  const editQuestion = (pageIndex: number, questionIndex: number, patch: Partial<Question>) =>
    setExtracted((previous) =>
      previous!.map((page, p) =>
        p !== pageIndex ? page : { ...page, questions: page.questions.map((q, i) => (i === questionIndex ? { ...q, ...patch } : q)) },
      ),
    );

  const missingItems: MissingItem[] = [];
  (extracted || []).forEach((page, p) =>
    page.questions.forEach((question, q) => {
      const id = `${p}_${q}`;
      if (!String(question.key || '').trim() && !ackBlank[id]) {
        missingItems.push({ id, label: page.label, question: question.question, options: question.options, question_type: question.question_type });
      }
    }),
  );

  // The same review flags the Streamlit app writes into #Review Notes*.
  const finalPages = (): PageResult[] =>
    (extracted || []).map((page, p) => ({
      label: page.label,
      subtopic: page.subtopic.trim(),
      questions: page.questions.map((question, q) => {
        const id = `${p}_${q}`;
        const flags = (question.review_flags || []).filter((flag) => !flag.includes('MISSING ANSWER KEY'));
        if (!String(question.key || '').trim()) flags.push(ackBlank[id] ? BLANK_FLAG : MISSING_FLAG);
        return { ...question, key: String(question.key || '').trim(), difficulty, bloom_level: bloom, review_flags: flags };
      }),
    }));

  const finish = () => {
    setBuilding(true);
    onDone({ mode: 'extract', pages: finalPages(), grade, subject, topic: topic.trim(), source_name: sourceName, notices: [] });
  };

  const create = () => {
    if (missingItems.length) {
      setPendingBuild(true);
      setDialogOpen(true);
    } else finish();
  };

  // After the missing-answer dialog is saved, carry on creating the paper.
  useEffect(() => {
    if (pendingBuild && !dialogOpen && extracted && missingItems.length === 0) {
      setPendingBuild(false);
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBuild, dialogOpen, extracted, ackBlank]);

  const settingsPanel = (
    <div className="space-y-6">
      <Card title="Extraction method">
        <div className="space-y-2">
          {config.extraction_methods.map((option) => (
            <label key={option.value} className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="qg-extract-method"
                className="mt-1 accent-green-500"
                checked={method === option.value}
                onChange={() => setMethod(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
          {method === 'ocr' && !config.ocr_available && (
            <Notice kind="error">The built-in OCR engine isn't installed on the server. Use the AI method or redeploy the service.</Notice>
          )}
        </div>
        {method === 'ai' && (
          <div className="mt-4 space-y-3">
            <ProviderPicker
              providers={config.providers}
              provider={provider}
              model={model}
              onChange={(nextProvider, nextModel) => {
                setProvider(nextProvider);
                setModel(nextModel);
              }}
            />
            <p className="text-xs text-gray-500">
              Pages with a real text layer are sent as plain text (any model works). Scanned pages and image uploads are sent as an
              image, which needs a vision-capable model.
            </p>
          </div>
        )}
      </Card>

      <Card title="Document settings">
        <div className="space-y-4">
          <Select label="Subject" value={subject} options={config.subjects} onChange={setSubject} />
          <TextInput label="Grade" value={grade} onChange={setGrade} />
          <TextInput label="Global topic" value={topic} onChange={setTopic} />
          <Select
            label="Difficulty (applied to every extracted question)"
            value={difficulty}
            options={config.plain_difficulties}
            onChange={setDifficulty}
          />
          <Select label="Bloom's level (applied to every extracted question)" value={bloom} options={config.bloom_levels} onChange={setBloom} />
        </div>
      </Card>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      {settingsPanel}

      <div className="space-y-6 min-w-0">
        <Card title={`Upload the question paper — a PDF, or page images (maximum ${config.max_pdf_pages} pages/images)`}>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            disabled={running}
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            Every question is transcribed exactly as printed — nothing is invented. If a solution isn't visible, you'll be asked for it
            before the paper is created.
          </p>
          {preparing && <p className="text-sm text-gray-400 animate-pulse mt-3">Reading the upload...</p>}
          {prepareError && (
            <div className="mt-3">
              <Notice kind="error">{prepareError}</Notice>
            </div>
          )}
        </Card>

        {pages.length > 0 && !extracted && (
          <div>
            <h3 className="text-lg font-bold text-white mb-3">📄 Pages to extract</h3>
            <div className="space-y-3">
              {pages.map((page, index) => (
                <div key={`${page.doc_id}-${page.page_number}-${index}`} className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 mb-2">
                      {page.label} —{' '}
                      {page.mode === 'text'
                        ? 'extracted text'
                        : method === 'ocr'
                        ? 'image — read with built-in OCR'
                        : 'image — sent to the AI model'}
                    </p>
                    {page.mode === 'text' ? (
                      <pre className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-lg p-3 h-36 overflow-auto whitespace-pre-wrap">
                        {page.page_text}
                      </pre>
                    ) : (
                      page.preview && <img src={page.preview} alt={page.label} className="w-full max-h-72 object-contain rounded-lg border border-gray-700 bg-gray-950" />
                    )}
                  </div>
                  <TextInput
                    label="Sub-topic for this page"
                    value={page.subtopic}
                    onChange={(value) => setPages((previous) => previous.map((p, i) => (i === index ? { ...p, subtopic: value } : p)))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {pages.length > 0 && !extracted && !subtopicsReady && <Notice kind="warning">Enter a sub-topic for every page before extracting.</Notice>}
        {pages.length > 0 && !extracted && !providerReady && <Notice kind="info">Choose a configured AI provider and model.</Notice>}

        {running && (
          <Card>
            <ProgressBar value={progress.value} text={progress.text} />
            <SecondaryButton className="mt-4" onClick={() => abortRef.current?.abort()}>
              Stop
            </SecondaryButton>
          </Card>
        )}

        {messages.map((message, index) => (
          <div key={index} className="space-y-2">
            <Notice kind={message.kind}>{message.text}</Notice>
            {message.detail !== undefined && (
              <details className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-300">
                <summary className="cursor-pointer">Text that was read</summary>
                <pre className="whitespace-pre-wrap text-xs mt-2">{message.detail}</pre>
              </details>
            )}
          </div>
        ))}

        {pages.length > 0 && !extracted && (
          <PrimaryButton className="w-full" disabled={running || !providerReady || !subtopicsReady} onClick={extract}>
            🔎 Extract questions from source
          </PrimaryButton>
        )}

        {extracted && (
          <ReviewSection
            extracted={extracted}
            ackBlank={ackBlank}
            onEdit={editQuestion}
            onEditSubtopic={(pageIndex, value) =>
              setExtracted((previous) => previous!.map((page, p) => (p === pageIndex ? { ...page, subtopic: value } : page)))
            }
          />
        )}

        {extracted && (
          <div className="space-y-3">
            {!topic.trim() && <Notice kind="info">Enter a global topic in the document settings.</Notice>}
            {extracted.some((page) => !page.subtopic.trim()) && <Notice kind="warning">Enter a sub-topic for every page.</Notice>}
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryButton
                className="flex-1"
                disabled={building || !topic.trim() || extracted.some((page) => !page.subtopic.trim())}
                onClick={create}
              >
                🚀 Create question paper from extracted questions
              </PrimaryButton>
              <SecondaryButton onClick={() => setExtracted(null)}>Back to pages</SecondaryButton>
            </div>
          </div>
        )}
      </div>

      {dialogOpen && (
        <MissingKeysDialog
          items={missingItems}
          onCancel={() => {
            setPendingBuild(false);
            setDialogOpen(false);
          }}
          onSave={(answers, blanks) => {
            setExtracted((previous) =>
              previous!.map((page, p) => ({
                ...page,
                questions: page.questions.map((question, q) => (answers[`${p}_${q}`] ? { ...question, key: answers[`${p}_${q}`] } : question)),
              })),
            );
            setAckBlank((previous) => ({ ...previous, ...blanks }));
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

const ReviewSection: React.FC<{
  extracted: ExtractedPage[];
  ackBlank: Record<string, boolean>;
  onEdit: (pageIndex: number, questionIndex: number, patch: Partial<Question>) => void;
  onEditSubtopic: (pageIndex: number, value: string) => void;
}> = ({ extracted, ackBlank, onEdit, onEditSubtopic }) => (
  <div>
    <h3 className="text-lg font-bold text-white mb-1">✏️ Review & edit extracted questions</h3>
    <p className="text-sm text-gray-400 mb-4">
      Everything below is editable — fix any transcription mistakes before creating the paper. A question flagged "missing answer key"
      needs an answer (or an explicit "leave blank") first.
    </p>
    <div className="space-y-3">
      {extracted.map((page, p) => (
        <details key={p} className="bg-gray-800/40 border border-gray-700/80 rounded-2xl px-5 py-3" open={p === 0}>
          <summary className="cursor-pointer font-bold text-gray-200">
            {page.label} — {page.questions.length} question(s)
          </summary>
          <div className="mt-4 space-y-6">
            <TextInput label="Sub-topic" value={page.subtopic} onChange={(value) => onEditSubtopic(p, value)} />
            {page.questions.map((question, q) => {
              const id = `${p}_${q}`;
              const keyMissing = !String(question.key || '').trim();
              return (
                <div key={q} className="space-y-3 border-t border-gray-700 pt-4">
                  <p className="font-bold text-gray-200">Question {q + 1}</p>
                  <TextArea label="Question" value={question.question} onChange={(value) => onEdit(p, q, { question: value })} />
                  {question.question_type === 'MCQ' ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {[0, 1, 2, 3].map((o) => (
                          <TextInput
                            key={o}
                            label={`Option ${o + 1}`}
                            value={question.options[o] || ''}
                            onChange={(value) => onEdit(p, q, { options: question.options.map((old, i) => (i === o ? value : old)) })}
                          />
                        ))}
                      </div>
                      <Select
                        label="Correct option"
                        value={keyMissing ? '— missing —' : String(question.key)}
                        options={['— missing —', '1', '2', '3', '4']}
                        onChange={(value) => onEdit(p, q, { key: value === '— missing —' ? '' : value })}
                      />
                    </>
                  ) : (
                    <TextInput
                      label="Correct (numerical) answer — leave blank if missing"
                      value={String(question.key || '')}
                      onChange={(value) => onEdit(p, q, { key: value })}
                    />
                  )}
                  <TextArea label="Explanation (optional)" value={question.explanation || ''} onChange={(value) => onEdit(p, q, { explanation: value })} />
                  {keyMissing && !ackBlank[id] && <Notice kind="warning">⚠️ No answer key set for this question yet.</Notice>}
                  {keyMissing && ackBlank[id] && <Notice kind="info">Answer left blank on purpose — it will be flagged for review.</Notice>}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  </div>
);

const MissingKeysDialog: React.FC<{
  items: MissingItem[];
  onCancel: () => void;
  onSave: (answers: Record<string, string>, blanks: Record<string, boolean>) => void;
}> = ({ items, onCancel, onSave }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [blanks, setBlanks] = useState<Record<string, boolean>>({});
  const [incomplete, setIncomplete] = useState(false);

  const save = () => {
    const missing = items.some((item) => !blanks[item.id] && !String(answers[item.id] || '').trim());
    setIncomplete(missing);
    if (missing) return;
    const cleanAnswers: Record<string, string> = {};
    const cleanBlanks: Record<string, boolean> = {};
    items.forEach((item) => {
      if (blanks[item.id]) cleanBlanks[item.id] = true;
      else cleanAnswers[item.id] = String(answers[item.id]).trim();
    });
    onSave(cleanAnswers, cleanBlanks);
  };

  return (
    <Modal title="Missing answer keys" onClose={onCancel}>
      <p className="text-sm text-gray-300 mb-4">
        {items.length} question(s) have no visible answer on the source. Choose the correct answer for each below, or explicitly leave it
        blank to flag it for manual review instead.
      </p>
      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.id} className="border-b border-gray-800 pb-4 space-y-3">
            <p className="text-sm text-gray-200">
              <b>{item.label}</b> — {plainMath(item.question).slice(0, 220)}
            </p>
            <Checkbox
              label="Leave blank for now (flagged for manual review)"
              checked={Boolean(blanks[item.id])}
              onChange={(checked) => setBlanks((previous) => ({ ...previous, [item.id]: checked }))}
            />
            {!blanks[item.id] &&
              (item.question_type === 'MCQ' ? (
                <div>
                  <Label>Correct option</Label>
                  <select
                    value={answers[item.id] || ''}
                    onChange={(e) => setAnswers((previous) => ({ ...previous, [item.id]: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:border-green-500 outline-none"
                  >
                    <option value="">Choose the correct option...</option>
                    {item.options.map((option, index) => (
                      <option key={index} value={String(index + 1)}>
                        {index + 1}. {plainMath(option).trim() || '(blank)'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <TextInput
                  label="Correct (numerical) answer"
                  value={answers[item.id] || ''}
                  onChange={(value) => setAnswers((previous) => ({ ...previous, [item.id]: value }))}
                />
              ))}
          </div>
        ))}
      </div>
      {incomplete && (
        <div className="mt-4">
          <Notice kind="warning">Choose an answer, or check "Leave blank", for every question above before continuing.</Notice>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <PrimaryButton className="flex-1" onClick={save}>
          Save and continue
        </PrimaryButton>
        <SecondaryButton className="flex-1" onClick={onCancel}>
          Cancel (keep editing)
        </SecondaryButton>
      </div>
    </Modal>
  );
};

export default ExtractFlow;
