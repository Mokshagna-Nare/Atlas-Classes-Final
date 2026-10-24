import React, { useEffect, useState } from 'react';
import AddToBankModal from './AddToBankModal';
import { QGError, QG_API_URL, qgJson } from './api';
import ExtractFlow from './ExtractFlow';
import GenerateFlow from './GenerateFlow';
import PaperViewer from './PaperViewer';
import { QGConfig, RunResult, countQuestions } from './types';
import { Notice, PrimaryButton, SecondaryButton } from './ui';

type Mode = 'generate' | 'extract';

// Kept outside React state so a finished result survives switching to
// another admin tab and back (until "Start new" or a page reload).
let savedResult: RunResult | null = null;
let savedAddedCount = 0;
let savedMode: Mode = 'generate';

const QuestionsGenerator: React.FC = () => {
  const [config, setConfig] = useState<QGConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [result, setResult] = useState<RunResult | null>(savedResult);
  const [addedCount, setAddedCount] = useState(savedAddedCount);
  const [viewing, setViewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const [waking, setWaking] = useState(false);

  // A free-tier service sleeps when idle and needs about a minute to wake
  // up, so keep retrying quietly for a while before showing an error.
  const loadConfig = async () => {
    setConfigError(null);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        setConfig(await qgJson<QGConfig>('/config'));
        setWaking(false);
        return;
      } catch (error: any) {
        if (!(error instanceof QGError) || error.status !== 0 || attempt === 5) {
          setWaking(false);
          setConfigError(error.message);
          return;
        }
        setWaking(true);
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (next: RunResult) => {
    savedResult = next;
    savedAddedCount = 0;
    setResult(next);
    setAddedCount(0);
  };

  const startNew = () => {
    savedResult = null;
    savedAddedCount = 0;
    setResult(null);
    setAddedCount(0);
    setRunKey((key) => key + 1);
  };

  return (
    <div className="text-white space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Questions generator</h2>
        <p className="text-gray-400 text-sm mt-1">
          Generate new NEET/JEE questions from a source PDF (with its real figures), or extract an existing question paper from a PDF or
          image — then view the paper or add it straight to the question bank.
        </p>
      </div>

      {configError && (
        <div className="space-y-3">
          <Notice kind="error">
            {configError}
            <span className="block text-xs mt-1 opacity-80">Service: {QG_API_URL}</span>
          </Notice>
          <SecondaryButton onClick={loadConfig}>Try again</SecondaryButton>
        </div>
      )}
      {!config && !configError && (
        <p className="text-sm text-gray-400 animate-pulse">
          {waking
            ? 'Waking up the Questions generator service — this can take up to a minute after it has been idle...'
            : 'Connecting to the Questions generator service...'}
        </p>
      )}

      {config && result && (
        <div className="bg-gray-800/40 border border-gray-700/80 rounded-2xl p-6 space-y-4">
          <Notice kind="success">
            Done — {countQuestions(result.pages)} question(s) {result.mode === 'generate' ? 'generated' : 'extracted'} from{' '}
            {result.pages.length} {result.mode === 'generate' ? 'selected page(s)' : 'page(s)'}.
          </Notice>
          {result.notices.map((notice, index) => (
            <Notice key={index} kind="info">
              {notice}
            </Notice>
          ))}
          {addedCount > 0 && <Notice kind="info">✅ {addedCount} question(s) from this result were added to the question bank.</Notice>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PrimaryButton onClick={() => setViewing(true)}>📄 View question paper</PrimaryButton>
            <PrimaryButton onClick={() => setAdding(true)} disabled={addedCount > 0}>
              {addedCount > 0 ? '✅ Added to question bank' : '➕ Add to question bank'}
            </PrimaryButton>
          </div>
          <p className="text-xs text-gray-500">
            This result stays here until you start a new one. The Word file can be downloaded from "View question paper".
          </p>
          <SecondaryButton className="w-full" onClick={startNew}>
            🔄 Start new
          </SecondaryButton>
        </div>
      )}

      {config && !result && (
        <>
          <div className="inline-flex bg-gray-900 border border-gray-700 rounded-xl p-1">
            {(
              [
                ['generate', 'Generate new questions'],
                ['extract', 'Extract existing questions'],
              ] as [Mode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  savedMode = value;
                  setMode(value);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  mode === value ? 'bg-green-600 text-on-accent' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div key={runKey}>
            <div className={mode === 'generate' ? '' : 'hidden'}>
              <GenerateFlow config={config} onDone={finish} />
            </div>
            <div className={mode === 'extract' ? '' : 'hidden'}>
              <ExtractFlow config={config} onDone={finish} />
            </div>
          </div>
        </>
      )}

      {config && result && viewing && <PaperViewer result={result} config={config} onClose={() => setViewing(false)} />}
      {config && result && adding && (
        <AddToBankModal
          result={result}
          onClose={() => setAdding(false)}
          onAdded={(count) => {
            savedAddedCount = count;
            setAddedCount(count);
          }}
        />
      )}
    </div>
  );
};

export default QuestionsGenerator;
