// On-device speech recognition: OpenAI's Whisper model running inside the browser (Transformers.js,
// WebAssembly), in a background worker so the page never freezes. Used where the browser's own
// recognition can't work — Brave and other privacy browsers (no access to Google's speech service),
// Firefox (no speech recognition at all), blocked networks — and whenever the admin chooses it.
// The model is downloaded once (cached by the browser); after that, audio never leaves the device.

export type LocalModel = 'standard' | 'high';

export const LOCAL_MODELS: Record<LocalModel, { id: string; label: string; size: string }> = {
  standard: { id: 'onnx-community/whisper-base', label: 'Standard', size: '77 MB' },
  high: { id: 'onnx-community/whisper-small', label: 'High accuracy', size: '250 MB' },
};

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Worker source (module worker from a Blob, so no bundler set-up is needed).
const WORKER_SOURCE = `
import { pipeline, env } from '${TRANSFORMERS_URL}';
env.allowLocalModels = false;
env.useBrowserCache = true;

const pipes = new Map();
const files = new Map();
let lastPost = 0;

function load(model) {
  if (!pipes.has(model)) {
    files.clear();
    const promise = pipeline('automatic-speech-recognition', model, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: info => {
        if (info.status === 'progress' && info.file) {
          files.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          const now = Date.now();
          // A few updates a second is plenty (hundreds would keep the page busy).
          if (now - lastPost > 250 || loaded >= total) { lastPost = now; self.postMessage({ type: 'progress', model, loaded, total }); }
        }
      },
    });
    promise.catch(() => pipes.delete(model));
    pipes.set(model, promise);
  }
  return pipes.get(model);
}

self.onmessage = async event => {
  const { id, type, model, audio, language } = event.data;
  try {
    const transcriber = await load(model);
    if (type === 'load') { self.postMessage({ id, type: 'ready', model }); return; }
    const output = await transcriber(audio, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ id, type: 'result', text: (output && output.text) || '' });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: String((error && error.message) || error) });
  }
};
`;

export interface LoadProgress { model: string; loaded: number; total: number }

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const progressListeners = new Set<(progress: LoadProgress) => void>();
const readyModels = new Set<string>();

function getWorker() {
  if (worker) return worker;
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  worker = new Worker(url, { type: 'module' });
  worker.onmessage = event => {
    const message = event.data;
    if (message.type === 'progress') {
      progressListeners.forEach(listener => listener(message));
      return;
    }
    if (message.type === 'ready') readyModels.add(message.model);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.type === 'error') entry.reject(new Error(message.message));
    else entry.resolve(message.type === 'result' ? message.text : true);
  };
  worker.onerror = event => {
    const error = new Error(event.message || 'The on-device speech engine failed to start.');
    pending.forEach(entry => entry.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

const call = (message: Record<string, unknown>, transfer: Transferable[] = []) =>
  new Promise<any>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...message, id }, transfer);
  });

export const onLoadProgress = (listener: (progress: LoadProgress) => void) => {
  progressListeners.add(listener);
  return () => { progressListeners.delete(listener); };
};

export const isModelReady = (model: LocalModel) => readyModels.has(LOCAL_MODELS[model].id);

/** Downloads (first time) and prepares the model. Safe to call repeatedly. */
export const loadModel = (model: LocalModel) => call({ type: 'load', model: LOCAL_MODELS[model].id });

/** True when the model files are already in the browser cache (no download needed). */
export async function isModelCached(model: LocalModel) {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const id = LOCAL_MODELS[model].id;
    return keys.some(request => request.url.includes(id) && request.url.includes('decoder_model_merged'));
  } catch {
    return false;
  }
}

// Always transcribe in English letters. Tested in Brave: for Hindi and Telugu speech this gives
// romanised text ("question bank lo filters ... repatiloga, mukhyamaina") that the task reader
// understands, while Hindi / Telugu script output garbled the English words (section names)
// and Telugu output often looped.
const WHISPER_LANGUAGE: Record<string, string> = { 'en-IN': 'en', 'hi-IN': 'en', 'te-IN': 'en' };

/** Hindi and Telugu need the bigger model on this device (the standard one mostly guesses). */
export const modelFor = (lang: string, chosen: LocalModel): LocalModel => (lang === 'en-IN' ? chosen : 'high');

/** Whisper sometimes gets stuck repeating one word on unclear audio. */
export const looksStuck = (text: string) => {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    run = words[i].replace(/\W/g, '') === words[i - 1].replace(/\W/g, '') ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
};

/** Whisper's stock outputs for silence / noise. */
const NOISE_RE = /\[(?:blank_audio|music|noise|silence|inaudible)[^\]]*\]|\((?:music|noise|silence|inaudible|applause|laughs?)[^)]*\)|♪+/gi;

export async function transcribe(audio: Float32Array, lang: string, model: LocalModel): Promise<string> {
  const text: string = await call({ type: 'transcribe', model: LOCAL_MODELS[model].id, audio, language: WHISPER_LANGUAGE[lang] || 'en' }, [audio.buffer]);
  return text.replace(NOISE_RE, ' ').replace(/\s+/g, ' ').trim();
}

/** Recorded audio (any format the browser recorded) → 16 kHz mono samples, what Whisper expects. */
export async function toWhisperAudio(blob: Blob): Promise<Float32Array> {
  const data = await blob.arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(data);
    const length = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offline = new OfflineAudioContext(1, length, 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    context.close().catch(() => undefined);
  }
}

/** Brave hides itself as Chrome; it exposes navigator.brave. */
export async function isBrave() {
  try {
    const brave = (navigator as any).brave;
    return !!(brave && (await brave.isBrave()));
  } catch {
    return false;
  }
}
