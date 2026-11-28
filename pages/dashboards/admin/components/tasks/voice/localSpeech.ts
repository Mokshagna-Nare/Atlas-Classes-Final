// On-device speech recognition: OpenAI's Whisper model running inside the browser (Transformers.js,
// WebAssembly), in a background worker so the page never freezes. Used where the browser's own
// recognition can't work — Brave and other privacy browsers (no access to Google's speech service),
// Firefox (no speech recognition at all), blocked networks — and whenever the admin chooses it.
// The model is downloaded once (cached by the browser); after that, audio never leaves the device.

export type LocalModel = 'standard' | 'high';

export const LOCAL_MODELS: Record<LocalModel, { id: string; label: string; size: string }> = {
  standard: { id: 'onnx-community/whisper-base', label: 'Standard', size: '~140 MB' },
  high: { id: 'onnx-community/whisper-small', label: 'High accuracy', size: '~250 MB' },
};

// English-only Whisper models: clearly more accurate on English (including Indian-accented
// English) than the multilingual ones, which also try to guess the language and drift into
// phonetic nonsense ("changes in question paper generator" -> "Tener sennapushin papagyan").
// Used for English; if one can't be downloaded, the multilingual model above is used instead.
const ENGLISH_MODELS: Record<LocalModel, string> = {
  standard: 'onnx-community/whisper-base.en',
  high: 'onnx-community/whisper-small.en',
};

const unavailable = new Set<string>();

/** Model ids to try for this language, best first. */
export const modelIds = (lang: string, model: LocalModel): string[] => {
  const ids = lang === 'en-IN' ? [ENGLISH_MODELS[model], LOCAL_MODELS[model].id] : [LOCAL_MODELS[model].id];
  const usable = ids.filter(id => !unavailable.has(id));
  return usable.length ? usable : [LOCAL_MODELS[model].id];
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

// The part that listens (encoder) loses a lot of accuracy when compressed, so the standard
// (base) model keeps it full-precision; the text part stays compressed. Falls back to the fully
// compressed files if those aren't available.
function dtypesFor(model) {
  return /whisper-base/.test(model) ? [{ encoder_model: 'fp32', decoder_model_merged: 'q8' }, 'q8'] : ['q8'];
}

async function create(model, onProgress) {
  let lastError;
  for (const dtype of dtypesFor(model)) {
    try {
      return await pipeline('automatic-speech-recognition', model, { dtype, device: 'wasm', progress_callback: onProgress });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function load(model) {
  if (!pipes.has(model)) {
    files.clear();
    const promise = create(model, info => {
        if (info.status === 'progress' && info.file) {
          files.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          const now = Date.now();
          // A few updates a second is plenty (hundreds would keep the page busy).
          if (now - lastPost > 250 || loaded >= total) { lastPost = now; self.postMessage({ type: 'progress', model, loaded, total }); }
        }
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
    // English-only models take no language / task (they only transcribe English).
    const english = model.endsWith('.en');
    const options = english ? { chunk_length_s: 30, stride_length_s: 5 } : { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 };
    const output = await transcriber(audio, options);
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

export const isModelReady = (model: LocalModel, lang = 'en-IN') => readyModels.has(modelIds(lang, model)[0]);

/**
 * Downloads (first time) and prepares the best model for this language. Safe to call repeatedly.
 * If the preferred (English-only) model can't be loaded, the multilingual one is used instead.
 */
export async function loadModel(model: LocalModel, lang = 'en-IN'): Promise<string> {
  let lastError: unknown;
  for (const id of modelIds(lang, model)) {
    try {
      await call({ type: 'load', model: id });
      return id;
    } catch (error) {
      lastError = error;
      if (id !== LOCAL_MODELS[model].id) unavailable.add(id);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** True when the model files are already in the browser cache (no download needed). */
export async function isModelCached(model: LocalModel, lang = 'en-IN') {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const id = modelIds(lang, model)[0];
    return keys.some(request => request.url.includes(`${id}/`) && request.url.includes('decoder_model_merged'));
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
  const id = await loadModel(model, lang);
  const text: string = await call({ type: 'transcribe', model: id, audio, language: WHISPER_LANGUAGE[lang] || 'en' }, [audio.buffer]);
  return text.replace(NOISE_RE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Trims the silence before and after speech (Whisper tends to invent words in it) and evens out
 * the volume, so a quiet microphone is heard as clearly as a loud one.
 */
export function cleanAudio(samples: Float32Array, rate = 16000): Float32Array {
  const frame = Math.round(rate * 0.02);
  const frames = Math.floor(samples.length / frame);
  if (frames < 5) return samples;
  const levels = new Float32Array(frames);
  let loudest = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += samples[i] * samples[i];
    levels[f] = Math.sqrt(sum / frame);
    loudest = Math.max(loudest, levels[f]);
  }
  if (loudest < 1e-4) return samples;
  const threshold = Math.max(0.004, loudest * 0.08);
  let first = 0;
  let last = frames - 1;
  while (first < frames && levels[first] < threshold) first++;
  while (last > first && levels[last] < threshold) last--;
  const keep = Math.round(rate * 0.3); // a little room around the speech
  const start = Math.max(0, first * frame - keep);
  const end = Math.min(samples.length, (last + 1) * frame + keep);
  const trimmed = samples.slice(start, end);
  let peak = 0;
  for (let i = 0; i < trimmed.length; i++) peak = Math.max(peak, Math.abs(trimmed[i]));
  if (peak > 0.001 && peak < 0.9) {
    const gain = Math.min(0.9 / peak, 20);
    for (let i = 0; i < trimmed.length; i++) trimmed[i] *= gain;
  }
  return trimmed;
}

const letters = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

const closeness = (said: string, target: string) =>
  said ? 1 - distance(said, target) / Math.max(said.length, target.length) : 0;

/**
 * Snaps near-misses of Atlas names to the real name ("question paper genrator" -> "question paper
 * generator", "questions bank" -> "question bank"). Only multi-word names, and only when the
 * words are very close, so ordinary speech is never rewritten.
 */
export function snapToVocabulary(text: string, vocabulary: string[]): string {
  const phrases = Array.from(new Set(vocabulary.map(v => v.trim().toLowerCase()).filter(v => v.includes(' ') && letters(v).length >= 8)));
  if (!phrases.length || !text) return text;
  let words = text.split(/\s+/);
  for (const phrase of phrases) {
    const target = letters(phrase);
    const size = phrase.split(/\s+/).length;
    // Same number of words, or one fewer (two words run together) — never more, so a
    // neighbouring word ("in", "a", "the") is never swallowed.
    for (let n = size; n >= Math.max(1, size - 1); n--) {
      for (let i = 0; i + n <= words.length; i++) {
        const window = words.slice(i, i + n);
        const said = letters(window.join(''));
        if (!said || said === target || said[0] !== target[0] || Math.abs(said.length - target.length) > target.length * 0.3) continue;
        const similarity = closeness(said, target);
        // A shorter window that matches as well means the edge word isn't part of the name.
        const edgeIsExtra = n > 1 && (closeness(letters(window.slice(0, -1).join('')), target) >= similarity
          || closeness(letters(window.slice(1).join('')), target) >= similarity);
        if (similarity >= 0.8 && !edgeIsExtra) {
          const tail = window[window.length - 1].match(/[.,!?;:]+$/)?.[0] || '';
          words = [...words.slice(0, i), ...phrase.split(/\s+/), ...words.slice(i + n)];
          if (tail) words[i + size - 1] += tail;
          i += size - 1;
        }
      }
    }
  }
  return words.join(' ');
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
