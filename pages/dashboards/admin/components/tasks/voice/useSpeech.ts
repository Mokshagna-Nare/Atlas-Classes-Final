import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalModel, LOCAL_MODELS, isBrave, isModelReady, loadModel, looksStuck, modelFor, onLoadProgress, toWhisperAudio, transcribe } from './localSpeech';

// Speech-to-text with two engines:
//   browser — the browser's own recognition (Chrome / Edge use Google's speech service, Safari
//             Apple's): instant, with live text while speaking. Adds picking the best of several
//             guesses using Atlas words, restarting when the browser cuts out mid-sentence, and
//             stopping after a pause.
//   local   — Whisper running on this device (see localSpeech.ts): for Brave and other privacy
//             browsers (no access to Google's service), Firefox (no recognition at all), or when
//             the browser engine reports a network error — we switch automatically.
// Both give a live voice level for the waveform and plain-language errors.

export type SpeechLang = 'en-IN' | 'hi-IN' | 'te-IN';
export type SpeechEngine = 'browser' | 'local';
/** 'auto' = browser engine where it works, on-device otherwise. */
export type EnginePreference = 'auto' | 'local';

export const SPEECH_LANGS: { value: SpeechLang; label: string; hint: string }[] = [
  { value: 'en-IN', label: 'English', hint: 'English (India) — Hinglish works too' },
  { value: 'hi-IN', label: 'हिन्दी', hint: 'Hindi' },
  { value: 'te-IN', label: 'తెలుగు', hint: 'Telugu' },
];

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

const recognitionClass = (): (new () => Recognition) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const localPossible = () =>
  typeof window !== 'undefined' && typeof (window as any).MediaRecorder === 'function' && typeof WebAssembly === 'object' && typeof Worker === 'function';

/** Some way to turn speech into text exists in this browser. */
export const speechSupported = () => !!recognitionClass() || localPossible();

const FALLBACK_KEY = 'atlas-voice-local';

/** Which engine to use right now. */
export async function resolveEngine(preference: EnginePreference): Promise<SpeechEngine> {
  if (!recognitionClass()) return 'local';
  if (preference === 'local' && localPossible()) return 'local';
  if (localPossible() && (await isBrave())) return 'local';
  try {
    if (sessionStorage.getItem(FALLBACK_KEY) === '1' && localPossible()) return 'local';
  } catch { /* ignore */ }
  return 'browser';
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Click the lock or site-settings icon in the address bar, allow the microphone, then try again.',
  'service-not-allowed': "This browser isn't allowing its speech service here.",
  'audio-capture': 'No microphone was found. Plug one in or check your sound settings.',
  network: "This browser can't reach its speech service.",
  'language-not-supported': "This browser can't recognise that language. Switch to English and try again.",
  'no-speech': "I didn't hear anything. Try again a little closer to the microphone.",
};

export type SpeechStatus = 'idle' | 'listening' | 'finishing' | 'transcribing';

interface Options {
  lang: SpeechLang;
  /** Words to favour when the engine offers several guesses (section names, admin names…). */
  vocabulary?: string[];
  /** Stop after this much quiet once something was said (ms). */
  silenceMs?: number;
  /** Hard limit for one recording (ms). */
  maxMs?: number;
  /** One short phrase (yes / no / a correction): no restarts, quicker stop. */
  short?: boolean;
  engine?: EnginePreference;
  localModel?: LocalModel;
  onFinal: (text: string) => void;
}

const LOUD = 0.07; // voice level that counts as speech (0–1)

const recorderType = () => {
  const MR = (window as any).MediaRecorder;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MR?.isTypeSupported?.(type)) || '';
};

export function useSpeech({
  lang, vocabulary = [], silenceMs = 2200, maxMs = 60000, short = false, engine: preference = 'auto', localModel: chosenModel = 'standard', onFinal,
}: Options) {
  const localModel = modelFor(lang, chosenModel);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [engine, setEngine] = useState<SpeechEngine | null>(null);
  /** Model download (first use of the on-device engine), 0–1; null when not downloading. */
  const [download, setDownload] = useState<number | null>(null);

  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finals = useRef<string[]>([]);
  const wanted = useRef(false); // the admin still wants to be listening
  const delivered = useRef(false);
  const heardSomething = useRef(false);
  const lastLoud = useRef(0);
  const levelRef = useRef(0);
  /** The level meter is actually measuring (some browsers start audio paused). */
  const meterLive = useRef(false);
  const silenceTimer = useRef<number | null>(null);
  const silenceWatch = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);
  const restarts = useRef(0);
  const switchToLocal = useRef(false);
  const audio = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const onFinalRef = useRef(onFinal);
  const vocabRef = useRef(vocabulary);
  const startRef = useRef<(forced?: SpeechEngine) => Promise<void>>(async () => undefined);
  onFinalRef.current = onFinal;
  vocabRef.current = vocabulary;

  // Download progress of the on-device model.
  useEffect(() => onLoadProgress(progress => {
    if (progress.model !== LOCAL_MODELS[localModel].id || !progress.total) return;
    const value = progress.loaded >= progress.total ? null : Math.floor((progress.loaded / progress.total) * 100) / 100;
    setDownload(previous => (previous === value ? previous : value));
  }), [localModel]);

  const clearTimers = () => {
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    if (maxTimer.current) window.clearTimeout(maxTimer.current);
    if (silenceWatch.current) window.clearInterval(silenceWatch.current);
    silenceTimer.current = maxTimer.current = silenceWatch.current = null;
  };

  const stopMeter = () => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.frame);
    audio.current.stream.getTracks().forEach(track => track.stop());
    audio.current.context.close().catch(() => undefined);
    audio.current = null;
    levelRef.current = 0;
    setLevel(0);
  };

  const startMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      const context = new AudioContext();
      // Browsers may start an AudioContext paused (autoplay rules); the meter needs it running.
      if (context.state === 'suspended') context.resume().catch(() => undefined);
      meterLive.current = false;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (time: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        if (sum > 0) meterLive.current = true;
        const value = Math.min(1, Math.sqrt(sum / data.length) * 4);
        levelRef.current = value;
        if (value > LOUD) { heardSomething.current = true; lastLoud.current = performance.now(); }
        if (time - last > 70) { setLevel(value); last = time; }
        if (audio.current) audio.current.frame = requestAnimationFrame(tick);
      };
      audio.current = { stream, context, frame: requestAnimationFrame(tick) };
      return stream;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') setError(ERRORS['not-allowed']);
      else if (err?.name === 'NotFoundError' || err?.name === 'NotReadableError') setError(ERRORS['audio-capture']);
      else setError(`Couldn't open the microphone. Check that no other app is using it and try again.${err?.name ? ` (${err.name}${err?.message ? `: ${String(err.message).slice(0, 80)}` : ''})` : ''}`);
      return null;
    }
  };

  /** Score a guess: the engine's confidence plus a bonus for each Atlas word it contains. */
  const pick = (result: any) => {
    let best = result[0]?.transcript || '';
    let bestScore = -1;
    for (let i = 0; i < result.length; i++) {
      const text: string = result[i].transcript || '';
      const lower = text.toLowerCase();
      const bonus = vocabRef.current.reduce((total, word) => total + (word && lower.includes(word) ? 0.08 : 0), 0);
      const score = (result[i].confidence || (i === 0 ? 0.5 : 0.3)) + bonus;
      if (score > bestScore) { best = text; bestScore = score; }
    }
    return best.trim();
  };

  const finish = useCallback(() => {
    clearTimers();
    stopMeter();
    wanted.current = false;
    recognition.current = null;
    recorder.current = null;
    setStatus('idle');
    setInterim('');
    if (delivered.current) return;
    delivered.current = true;
    const text = finals.current.join(' ').replace(/\s+/g, ' ').trim();
    if (text) onFinalRef.current(text);
  }, []);

  // ---- browser engine ----------------------------------------------------------------------
  const armSilence = () => {
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    silenceTimer.current = window.setTimeout(() => {
      if (heardSomething.current) stop();
    }, short ? 1400 : silenceMs);
  };

  const beginBrowser = () => {
    const Klass = recognitionClass();
    if (!Klass) return;
    const rec = new Klass();
    rec.lang = lang;
    rec.continuous = !short;
    rec.interimResults = true;
    rec.maxAlternatives = 4;

    rec.onspeechstart = () => armSilence();
    rec.onresult = (event: any) => {
      heardSomething.current = true;
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finals.current.push(pick(result));
        else live += `${result[0]?.transcript || ''} `;
      }
      setFinalText(finals.current.join(' '));
      setInterim(live.trim());
      armSilence();
    };
    rec.onerror = (event: any) => {
      const code = event?.error;
      if (code === 'aborted') return;
      if (code === 'no-speech' && (heardSomething.current || (wanted.current && restarts.current < 2 && !short))) return;
      // No access to the browser's speech service (Brave, blocked networks…): use on-device recognition.
      if ((code === 'network' || code === 'service-not-allowed') && localPossible() && !finals.current.length) {
        switchToLocal.current = true;
        wanted.current = false;
        try { sessionStorage.setItem(FALLBACK_KEY, '1'); } catch { /* ignore */ }
        return;
      }
      if (ERRORS[code]) setError(ERRORS[code]);
      wanted.current = false;
    };
    rec.onend = () => {
      if (switchToLocal.current) {
        switchToLocal.current = false;
        recognition.current = null;
        clearTimers();
        stopMeter();
        setNotice("This browser can't reach its online speech service, so I've switched to on-device recognition.");
        startRef.current('local');
        return;
      }
      // Browsers end the session on long pauses or network hiccups; carry on if the admin is still talking.
      if (wanted.current && !short && restarts.current < 6) {
        restarts.current += 1;
        try { rec.start(); return; } catch { /* fall through */ }
      }
      finish();
    };

    recognition.current = rec;
    try {
      rec.start();
    } catch {
      setError('The microphone is busy. Close other apps or tabs using it and try again.');
      finish();
    }
  };

  // ---- on-device engine ----------------------------------------------------------------------
  const transcribeRecording = async (blob: Blob) => {
    setStatus('transcribing');
    try {
      if (!isModelReady(localModel)) await loadModel(localModel);
      setDownload(null);
      const samples = await toWhisperAudio(blob);
      if (samples.length < 16000 * 0.3) { finish(); return; }
      let text = await transcribe(samples, lang, localModel);
      if (looksStuck(text)) {
        text = '';
        setError(lang === 'en-IN'
          ? "I couldn't make that out clearly. Please try again, a little slower."
          : `I couldn't make that out clearly. On-device recognition is weaker for ${lang === 'te-IN' ? 'Telugu' : 'Hindi'} — try English, or use Chrome or Edge for the best ${lang === 'te-IN' ? 'Telugu' : 'Hindi'} recognition.`);
      }
      // Whisper "hears" these in silence; ignore them unless the meter actually picked up speech.
      if (!heardSomething.current && /^(?:you|thank you|thanks|thanks for watching|bye|okay|\.+)[.!]*$/i.test(text)) text = '';
      if (text) {
        finals.current = [text];
        setFinalText(text);
      } else if (!short) {
        setError(ERRORS['no-speech']);
      }
    } catch (err: any) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setError(offline && !isModelReady(localModel)
        ? 'The on-device speech model needs an internet connection the first time, to download. Connect and try again.'
        : `On-device recognition failed${err?.message ? ` (${String(err.message).slice(0, 120)})` : ''}. Please try again or type the task.`);
    }
    finish();
  };

  const beginLocal = (stream: MediaStream) => {
    // Get the model ready while the admin is still talking.
    if (!isModelReady(localModel)) loadModel(localModel).catch(() => undefined);

    const type = recorderType();
    let rec: MediaRecorder;
    try {
      rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    } catch {
      setError("This browser can't record audio. Please type the task instead.");
      finish();
      return;
    }
    chunks.current = [];
    rec.ondataavailable = event => { if (event.data?.size) chunks.current.push(event.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || type || 'audio/webm' });
      // If the meter couldn't measure anything, don't assume silence — let Whisper decide.
      const spoke = heardSomething.current || !meterLive.current;
      clearTimers();
      stopMeter();
      if (delivered.current) { finish(); return; } // cancelled
      if (!spoke) {
        if (!short) setError(ERRORS['no-speech']);
        finish();
        return;
      }
      transcribeRecording(blob);
    };
    recorder.current = rec;
    rec.start(250);

    // Stop after a pause once something was said.
    const quiet = short ? 1300 : silenceMs;
    silenceWatch.current = window.setInterval(() => {
      if (heardSomething.current && performance.now() - lastLoud.current > quiet) stop();
    }, 150);
  };

  // ---- shared --------------------------------------------------------------------------------
  const start = useCallback(async (forced?: SpeechEngine) => {
    if (wanted.current) return;
    const chosen = forced || (await resolveEngine(preference));
    if (chosen === 'browser' && !recognitionClass()) return;
    if (chosen === 'local' && !localPossible()) {
      setError("Voice input isn't available in this browser. Please type the task instead.");
      return;
    }
    setEngine(chosen);
    setError(null);
    if (!forced) setNotice(null);
    setInterim('');
    setFinalText('');
    finals.current = [];
    delivered.current = false;
    heardSomething.current = false;
    lastLoud.current = performance.now();
    restarts.current = 0;
    switchToLocal.current = false;
    wanted.current = true;
    setStatus('listening');

    const stream = await startMeter();
    if (!stream) {
      wanted.current = false;
      setStatus('idle');
      return;
    }

    maxTimer.current = window.setTimeout(() => stop(), short ? 8000 : chosen === 'local' ? Math.min(maxMs, 30000) : maxMs);
    if (chosen === 'browser') {
      armSilence();
      beginBrowser();
    } else {
      beginLocal(stream);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, short, maxMs, silenceMs, preference, localModel]);
  startRef.current = start;

  /** Stop listening and use what was said. */
  const stop = useCallback(() => {
    if (!wanted.current && !recognition.current && !recorder.current) return;
    wanted.current = false;
    clearTimers();
    if (recorder.current) {
      setStatus('finishing');
      const rec = recorder.current;
      recorder.current = null;
      try { if (rec.state !== 'inactive') rec.stop(); else finish(); } catch { finish(); }
      return;
    }
    setStatus('finishing');
    try { recognition.current?.stop(); } catch { finish(); }
    // Some browsers never fire `end` after stop(); don't hang.
    window.setTimeout(() => { if (recognition.current) finish(); }, 1500);
  }, [finish]);

  /** Stop listening and throw away what was said. */
  const cancel = useCallback(() => {
    delivered.current = true;
    wanted.current = false;
    switchToLocal.current = false;
    try { recognition.current?.abort(); } catch { /* already stopped */ }
    try { if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop(); } catch { /* ignore */ }
    finish();
  }, [finish]);

  useEffect(() => () => {
    delivered.current = true;
    wanted.current = false;
    try { recognition.current?.abort(); } catch { /* ignore */ }
    try { if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop(); } catch { /* ignore */ }
    clearTimers();
    stopMeter();
  }, []);

  return {
    status, interim, finalText, error, notice, level, engine, download,
    start: () => start(), stop, cancel, setError, supported: speechSupported(),
  };
}

/** Reads a short reply aloud in the chosen language (if the device has a voice for it). Resolves when done. */
export function speak(text: string, lang: SpeechLang): Promise<void> {
  return new Promise(resolve => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || !text) return resolve();
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[“”]/g, ''));
      utterance.lang = lang;
      const voices = synth.getVoices();
      const voice = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.slice(0, 2))) || voices.find(v => v.lang === 'en-IN');
      if (voice) utterance.voice = voice;
      utterance.rate = 1.03;
      const done = () => resolve();
      utterance.onend = done;
      utterance.onerror = done;
      window.setTimeout(done, Math.min(12000, 1500 + text.length * 70)); // never wait forever
      synth.speak(utterance);
    } catch {
      resolve(); // reading aloud is optional
    }
  });
}

export const stopSpeaking = () => {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
};
