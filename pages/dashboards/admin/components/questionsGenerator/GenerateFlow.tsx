import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QGError, qgJson, sleep } from './api';
import ProviderPicker from './ProviderPicker';
import { PageResult, QGConfig, Question, RunResult, countQuestions } from './types';
import { Card, Checkbox, Notice, PrimaryButton, ProgressBar, SecondaryButton, Select, TextInput } from './ui';

interface PreparedFigure {
  index: number;
  image: string;
  size_kb: number;
  details: string;
}

interface PreparedPage {
  page_number: number;
  has_text: boolean;
  chars: number;
  preview: string | null;
  figures: PreparedFigure[];
}

interface Prepared {
  doc_id: string;
  file_name: string;
  page_count: number;
  pages: PreparedPage[];
}

interface PageSetting {
  selected: boolean;
  count: number;
  subtopic: string;
  figures: number[];
}

interface PageResponse {
  questions: Question[];
  rejected: string[];
  missing_figures: string[];
  error: string | null;
  fatal: boolean;
  previous_questions: string[];
  previous_concepts: unknown[];
  notes: { kind: string; text: string }[];
}

interface PageLog {
  page_number: number;
  messages: { kind: 'warning' | 'error' | 'info'; text: string }[];
  rejected: string[];
}

const formatEta = (seconds: number) =>
  seconds < 60 ? `approximately ${seconds.toFixed(0)} seconds remaining` : `approximately ${(seconds / 60).toFixed(1)} minutes remaining`;

const GenerateFlow: React.FC<{ config: QGConfig; onDone: (result: RunResult) => void }> = ({ config, onDone }) => {
  const firstProvider = config.providers.find((p) => p.configured);
  const [provider, setProvider] = useState(firstProvider?.name || config.providers[0]?.name || '');
  const [model, setModel] = useState(firstProvider?.default_model || '');
  const [sizePreset, setSizePreset] = useState(config.default_figure_size_preset);
  const [labelMode, setLabelMode] = useState(config.default_figure_label_mode);
  const [sendFigures, setSendFigures] = useState(false);
  const [examMode, setExamMode] = useState(config.default_exam_mode);
  const [subject, setSubject] = useState(config.default_subject);
  const [grade, setGrade] = useState('11');
  const [topic, setTopic] = useState('');
  const [questionType, setQuestionType] = useState(config.question_types[0]);
  const [difficulty, setDifficulty] = useState(config.difficulty_mixes[0]);
  const [skipPreviews, setSkipPreviews] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<number, PageSetting>>({});

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ value: 0, text: '' });
  const [status, setStatus] = useState('');
  const [eta, setEta] = useState('');
  const [conceptsText, setConceptsText] = useState('');
  const [logs, setLogs] = useState<PageLog[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const preparedFor = useRef('');

  // Upload (or re-read after a figure option changes) -> pages + figures.
  const prepare = async (target: File, signal?: AbortSignal): Promise<Prepared> => {
    const form = new FormData();
    form.append('file', target);
    form.append('label_mode', labelMode);
    form.append('size_preset', sizePreset);
    form.append('previews', skipPreviews ? 'false' : 'true');
    return qgJson<Prepared>('/generate/prepare', { form, signal });
  };

  useEffect(() => {
    if (!file) return;
    const signature = `${file.name}|${file.size}|${file.lastModified}|${labelMode}|${sizePreset}|${skipPreviews}`;
    if (preparedFor.current === signature) return;
    const controller = new AbortController();
    setPreparing(true);
    setPrepareError(null);

    prepare(file, controller.signal)
      .then((data) => {
        preparedFor.current = signature;
        setPrepared(data);
        setSettings((previous) => {
          const next: Record<number, PageSetting> = {};
          for (const page of data.pages) {
            const old = previous[page.page_number];
            next[page.page_number] = old
              ? { ...old, figures: old.figures.filter((index) => index <= page.figures.length) }
              : { selected: page.has_text, count: 4, subtopic: '', figures: [] };
          }
          return next;
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setPrepared(null);
        setPrepareError(error.message);
      })
      .finally(() => !controller.signal.aborted && setPreparing(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, labelMode, sizePreset, skipPreviews]);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const updatePage = (pageNumber: number, patch: Partial<PageSetting>) =>
    setSettings((previous) => ({ ...previous, [pageNumber]: { ...previous[pageNumber], ...patch } }));

  const selectedRows = useMemo(() => {
    if (!prepared) return [];
    return prepared.pages
      .filter((page) => settings[page.page_number]?.selected)
      .map((page) => {
        const setting = settings[page.page_number];
        return {
          page,
          count: Math.max(setting.count || 1, setting.figures.length),
          subtopic: setting.subtopic.trim(),
          figures: setting.figures,
        };
      });
  }, [prepared, settings]);

  const requestedTotal = selectedRows.reduce((total, row) => total + row.count, 0);
  const providerReady = Boolean(config.providers.find((p) => p.name === provider)?.configured && model.trim());
  const canStart =
    Boolean(prepared) &&
    providerReady &&
    Boolean(topic.trim()) &&
    selectedRows.length > 0 &&
    requestedTotal <= config.max_total_questions &&
    selectedRows.every((row) => row.subtopic);

  const start = async () => {
    if (!prepared || !file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setRunError(null);
    setLogs([]);
    setEta('');
    setConceptsText('');

    let docId = prepared.doc_id;
    let previousQuestions: string[] = [];
    let previousConcepts: unknown[] = [];
    let completed = 0;
    const durations: number[] = [];
    const results: PageResult[] = [];
    const total = selectedRows.length;
    let stopped = false;

    try {
      for (let index = 0; index < total; index++) {
        const row = selectedRows[index];
        const pageStart = performance.now();
        const log: PageLog = { page_number: row.page.page_number, messages: [], rejected: [] };
        setProgress({ value: index / total, text: `Generating questions for page ${row.page.page_number}...` });
        setStatus(
          `Page ${index + 1} of ${total} • ${row.count} question(s) requested • ${completed}/${requestedTotal} questions completed`,
        );

        const body = {
          page_number: row.page.page_number,
          count: row.count,
          subtopic: row.subtopic,
          figure_indexes: row.figures,
          provider,
          model: model.trim(),
          exam_mode: examMode,
          subject,
          topic: topic.trim(),
          question_type: questionType,
          difficulty_mix: difficulty,
          send_figure_images: sendFigures,
          label_mode: labelMode,
          size_preset: sizePreset,
          previous_questions: previousQuestions,
          previous_concepts: previousConcepts,
        };

        let response: PageResponse;
        try {
          response = await qgJson<PageResponse>('/generate/page', { json: { ...body, doc_id: docId }, signal: controller.signal });
        } catch (error: any) {
          // The server forgot the upload (restart / idle cleanup): send it again once.
          if (error instanceof QGError && error.status === 409) {
            docId = (await prepare(file, controller.signal)).doc_id;
            response = await qgJson<PageResponse>('/generate/page', { json: { ...body, doc_id: docId }, signal: controller.signal });
          } else {
            throw error;
          }
        }

        previousQuestions = response.previous_questions;
        previousConcepts = response.previous_concepts;
        completed += response.questions.length;

        for (const note of response.notes || []) {
          log.messages.push({ kind: note.kind === 'error' ? 'error' : note.kind === 'warning' ? 'warning' : 'info', text: note.text });
        }
        if (response.error) log.messages.push({ kind: response.fatal ? 'error' : 'warning', text: response.error });
        if (response.missing_figures.length) {
          log.messages.push({
            kind: 'warning',
            text: `Page ${row.page.page_number}: the AI did not frame a question for selected figure(s) ${response.missing_figures.join(', ')} even after a dedicated retry — those figures are not in the document. Try again, or use a different model.`,
          });
        }
        if (!response.questions.length && !response.fatal) {
          log.messages.push({ kind: 'warning', text: `Page ${row.page.page_number}: the model didn't produce any usable questions for this page.` });
        }
        log.rejected = response.rejected;
        setLogs((previous) => [...previous, log]);

        if (response.fatal) {
          setRunError(response.error);
          stopped = true;
          break;
        }

        results.push({ page_number: row.page.page_number, subtopic: row.subtopic, questions: response.questions });

        const elapsed = (performance.now() - pageStart) / 1000;
        durations.push(elapsed);
        const average = durations.reduce((a, b) => a + b, 0) / durations.length;
        setEta(
          `⏱️ Estimated time remaining: ${formatEta(average * (total - index - 1))}. Page ${index + 1}/${total} completed in ${elapsed.toFixed(1)} seconds.`,
        );
        setConceptsText(`🧠 ${previousConcepts.length} distinct concept(s) tested so far — later pages are steered away from repeating these.`);

        if (index < total - 1) await sleep(config.min_request_delay * 1000, controller.signal);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        stopped = true;
        setRunError('Generation stopped.');
      } else {
        setRunError(error.message);
        stopped = true;
      }
    }

    if (stopped && countQuestions(results) === 0) {
      setRunning(false);
      return;
    }

    try {
      setProgress({ value: 1, text: 'Running the final duplicate review...' });
      const final = await qgJson<{ results: PageResult[]; flagged: number }>('/generate/finalize', { json: { results } });
      const totalQuestions = countQuestions(final.results);

      if (totalQuestions === 0) {
        setRunError(`No valid questions were generated. Check the ${provider} model and the PDF's text.`);
        setRunning(false);
        return;
      }

      const notices: string[] = [];
      if (stopped) notices.push(`The run stopped early — this result contains the ${final.results.length} page(s) finished before that.`);
      if (final.flagged) {
        notices.push(
          `Flagged ${final.flagged} additional question(s) as possible cross-page duplicates in #Review Notes* — nothing was removed, check those notes before use.`,
        );
      }

      onDone({
        mode: 'generate',
        pages: final.results,
        grade,
        subject,
        topic: topic.trim(),
        source_name: prepared.file_name,
        notices,
      });
    } catch (error: any) {
      setRunError(error.message);
      setRunning(false);
    }
  };

  if (running) {
    return (
      <Card>
        <div className="space-y-4">
          <ProgressBar value={progress.value} text={progress.text} />
          {status && <Notice kind="info">{status}</Notice>}
          {eta && <p className="text-xs text-gray-400">{eta}</p>}
          {conceptsText && <p className="text-xs text-gray-400">{conceptsText}</p>}
          <PageLogs logs={logs} />
          {runError && <Notice kind="error">{runError}</Notice>}
          <SecondaryButton onClick={() => abortRef.current?.abort()}>Stop</SecondaryButton>
          <p className="text-xs text-gray-500">Keep this tab open until generation finishes.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <div className="space-y-6">
        <Card title="AI provider">
          <ProviderPicker
            providers={config.providers}
            provider={provider}
            model={model}
            onChange={(nextProvider, nextModel) => {
              setProvider(nextProvider);
              setModel(nextModel);
            }}
          />
        </Card>

        <Card title="Source figures">
          <div className="space-y-4">
            <Select
              label="Figure image size in the Word file"
              value={sizePreset}
              options={config.figure_size_presets}
              onChange={setSizePreset}
              hint="Every figure is compressed to stay within this size per image."
            />
            <Select
              label="Labels on figure images"
              value={labelMode}
              options={config.figure_label_modes}
              onChange={setLabelMode}
              hint="Printed part names, panel letters, figure numbers and captions are never shown."
            />
            <Checkbox label="Let the AI see the selected figures (vision models only)" checked={sendFigures} onChange={setSendFigures} />
          </div>
        </Card>

        <Card title="Generation settings">
          <div className="space-y-4">
            <Select label="Exam mode" value={examMode} options={config.exam_modes} onChange={setExamMode} />
            <Select label="Subject" value={subject} options={config.subjects} onChange={setSubject} />
            <TextInput label="Grade" value={grade} onChange={setGrade} />
            <TextInput label="Global topic" value={topic} onChange={setTopic} placeholder="Example: Animal tissues" />
            <Select label="Question type" value={questionType} options={config.question_types} onChange={setQuestionType} />
            <Select label="Difficulty mix" value={difficulty} options={config.difficulty_mixes} onChange={setDifficulty} />
            {examMode === 'NEET' && subject === 'Mathematics' && <Notice kind="warning">Mathematics is not a standard NEET subject.</Notice>}
            {examMode.startsWith('JEE') && subject === 'Biology' && <Notice kind="warning">Biology is not a standard JEE subject.</Notice>}
          </div>
        </Card>
      </div>

      <div className="space-y-6 min-w-0">
        <Card title={`Upload a PDF (maximum ${config.max_pdf_pages} pages)`}>
          <div className="space-y-3">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const chosen = e.target.files?.[0] || null;
                preparedFor.current = '';
                setPrepared(null);
                setSettings({});
                setFile(chosen);
              }}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-green-600 file:text-on-accent hover:file:bg-green-500"
            />
            <Checkbox
              label="⚡ Skip page image previews for faster loading"
              checked={skipPreviews}
              onChange={setSkipPreviews}
            />
            {preparing && <p className="text-sm text-gray-400 animate-pulse">Reading the PDF and detecting figures on each page...</p>}
            {prepareError && <Notice kind="error">{prepareError}</Notice>}
          </div>
        </Card>

        {prepared && (
          <>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">📄 Preview and configure each page</h3>
              <p className="text-sm text-gray-400 mb-4">
                Select or deselect pages, enter the number of questions, and enter a sub-topic.
              </p>
              <div className="space-y-4">
                {prepared.pages.map((page) => (
                  <PageCard
                    key={page.page_number}
                    page={page}
                    setting={settings[page.page_number]}
                    maxQuestions={config.max_total_questions}
                    skipPreviews={skipPreviews}
                    onChange={(patch) => updatePage(page.page_number, patch)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total PDF pages" value={prepared.page_count} />
              <Stat label="Selected pages" value={selectedRows.length} />
              <Stat label="Requested questions" value={requestedTotal} />
              <Stat label="Maximum allowed" value={config.max_total_questions} />
            </div>

            {requestedTotal > config.max_total_questions && (
              <Notice kind="error">
                The maximum allowed is {config.max_total_questions} questions per run. Reduce the page question counts.
              </Notice>
            )}
            {selectedRows.some((row) => !row.subtopic) && <Notice kind="warning">Enter a sub-topic for every selected page.</Notice>}
            {!selectedRows.length && <Notice kind="info">Select at least one PDF page.</Notice>}
          </>
        )}

        {prepared && !topic.trim() && <Notice kind="info">Enter a global topic in the settings.</Notice>}
        {prepared && !providerReady && <Notice kind="info">Choose a configured AI provider and model in the settings.</Notice>}
        <PageLogs logs={logs} />
        {runError && <Notice kind="error">{runError}</Notice>}

        <PrimaryButton className="w-full" disabled={!canStart} onClick={start}>
          🚀 Generate validated question bank
        </PrimaryButton>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-4 text-center">
    <div className="text-2xl font-black text-green-400">{value}</div>
    <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">{label}</div>
  </div>
);

const PageLogs: React.FC<{ logs: PageLog[] }> = ({ logs }) => (
  <>
    {logs.map((log) => (
      <div key={log.page_number} className="space-y-2">
        {log.messages.map((message, index) => (
          <Notice key={index} kind={message.kind}>
            {message.text}
          </Notice>
        ))}
        {log.rejected.length > 0 && (
          <details className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-300">
            <summary className="cursor-pointer">Skipped items — page {log.page_number}</summary>
            <p className="text-xs text-gray-500 mt-2">
              These items had nothing usable to include (empty or unparseable) — everything else the model produced is in the
              document, flagged for review rather than dropped.
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              {log.rejected.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    ))}
  </>
);

const PageCard: React.FC<{
  page: PreparedPage;
  setting?: PageSetting;
  maxQuestions: number;
  skipPreviews: boolean;
  onChange: (patch: Partial<PageSetting>) => void;
}> = ({ page, setting, maxQuestions, skipPreviews, onChange }) => {
  if (!setting) return null;
  const effective = Math.max(setting.count || 1, setting.figures.length);
  const toggleFigure = (index: number, checked: boolean) =>
    onChange({ figures: checked ? [...setting.figures, index].sort((a, b) => a - b) : setting.figures.filter((i) => i !== index) });

  return (
    <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] gap-6">
      <div>
        <h4 className="font-bold text-white mb-2">📄 Page {page.page_number} preview</h4>
        {page.preview ? (
          <img src={page.preview} alt={`Page ${page.page_number}`} className="w-full rounded-lg border border-gray-700 bg-[#ffffff]" />
        ) : (
          <p className="text-xs text-gray-500">
            {skipPreviews ? "Preview skipped for faster loading — the page's text is still fully available for generation." : 'This page could not be rendered.'}
          </p>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        <Checkbox label={<b>Use page {page.page_number}</b>} checked={setting.selected} onChange={(selected) => onChange({ selected })} />
        <TextInput
          label="Questions for this page"
          type="number"
          min={1}
          max={maxQuestions}
          value={String(setting.count)}
          onChange={(value) => onChange({ count: Math.min(maxQuestions, Math.max(1, parseInt(value, 10) || 1)) })}
        />
        <TextInput
          label="Sub-topic for this page"
          value={setting.subtopic}
          onChange={(subtopic) => onChange({ subtopic })}
          placeholder="Example: Mechanism of double fertilisation"
        />

        {page.figures.length > 0 ? (
          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-sm font-bold text-gray-200">
                🖼️ {page.figures.length} figure(s) found on page {page.page_number} — tick the ones to use
              </span>
              <div className="flex gap-2">
                <SecondaryButton className="!py-1.5 text-xs" onClick={() => onChange({ figures: page.figures.map((f) => f.index) })}>
                  Select all
                </SecondaryButton>
                <SecondaryButton className="!py-1.5 text-xs" onClick={() => onChange({ figures: [] })}>
                  Clear
                </SecondaryButton>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {page.figures.map((figure) => (
                <div key={figure.index} className="bg-[#ffffff] rounded-lg p-2 flex flex-col">
                  <img src={figure.image} alt={`Figure ${figure.index}`} className="w-full h-32 object-contain" />
                  <p className="text-[11px] text-[#4b5563] mt-1">
                    Figure {figure.index} · {figure.size_kb} KB{figure.details ? ` · ${figure.details}` : ''}
                  </p>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1f2937] mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-green-600"
                      checked={setting.figures.includes(figure.index)}
                      onChange={(e) => toggleFigure(figure.index, e.target.checked)}
                    />
                    Use figure {figure.index}
                  </label>
                </div>
              ))}
            </div>
            {setting.figures.length > 0 && (
              <div className="mt-3">
                <Notice kind="success">
                  {setting.figures.length} of {page.figures.length} figure(s) selected — one question will be framed from each, with
                  the figure placed inside that question.
                </Notice>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">🖼️ No figures found on this page.</p>
        )}

        {effective > setting.count && (
          <Notice kind="info">Questions for this page raised to {effective} so every selected figure gets its own question.</Notice>
        )}
        <p className="text-xs text-gray-500">
          {page.has_text ? `Extracted text: ${page.chars.toLocaleString()} characters` : '⚠️ No extractable text was found on this page.'}
        </p>
      </div>
    </div>
  );
};

export default GenerateFlow;
