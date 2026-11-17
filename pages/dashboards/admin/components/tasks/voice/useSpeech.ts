import { useCallback, useEffect, useRef, useState } from 'react';

// Speech-to-text with the browser's own engine (Chrome / Edge use Google's speech service,
// Safari uses Apple's). Adds what the raw API lacks: picking the best of several guesses using
// Atlas words, restarting when the browser cuts out mid-sentence, stopping after a pause, a live
// voice level for the waveform, and plain-language errors.

export type SpeechLang = 'en-IN' | 'hi-IN' | 'te-IN';

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

export const speechSupported = () => !!recognitionClass();

const ERRORS: Record<string, string> = {
  'not-allowed': "Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then try again.",
  'service-not-allowed': "This browser isn't allowing speech recognition here. Try Chrome or Edge, or type the task instead.",
  'audio-capture': 'No microphone was found. Plug one in or check your sound settings.',
  network: 'Speech recognition needs an internet connection. Check your connection and try again.',
  'language-not-supported': "This browser can't recognise that language. Switch to English and try again.",
  'no-speech': "I didn't hear anything. Try again a little closer to the microphone.",
};

export type SpeechStatus = 'idle' | 'listening' | 'finishing';

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
  onFinal: (text: string) => void;
}

export function useSpeech({ lang, vocabulary = [], silenceMs = 2200, maxMs = 60000, short = false, onFinal }: Options) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recognition = useRef<Recognition | null>(null);
  const finals = useRef<string[]>([]);
  const wanted = useRef(false); // the admin still wants to be listening
  const delivered = useRef(false);
  const heardSomething = useRef(false);
  const silenceTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);
  const restarts = useRef(0);
  const audio = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const onFinalRef = useRef(onFinal);
  const vocabRef = useRef(vocabulary);
  onFinalRef.current = onFinal;
  vocabRef.current = vocabulary;

  const clearTimers = () => {
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    if (maxTimer.current) window.clearTimeout(maxTimer.current);
    silenceTimer.current = maxTimer.current = null;
  };

  const stopMeter = () => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.frame);
    audio.current.stream.getTracks().forEach(track => track.stop());
    audio.current.context.close().catch(() => undefined);
    audio.current = null;
    setLevel(0);
  };

  const startMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (time: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        if (time - last > 70) {
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          last = time;
        }
        if (audio.current) audio.current.frame = requestAnimationFrame(tick);
      };
      audio.current = { stream, context, frame: requestAnimationFrame(tick) };
      return true;
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') setError(ERRORS['not-allowed']);
      else if (err?.name === 'NotFoundError') setError(ERRORS['audio-capture']);
      return false;
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
    setStatus('idle');
    setInterim('');
    if (delivered.current) return;
    delivered.current = true;
    const text = finals.current.join(' ').replace(/\s+/g, ' ').trim();
    if (text) onFinalRef.current(text);
  }, []);

  const armSilence = () => {
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    silenceTimer.current = window.setTimeout(() => {
      if (heardSomething.current) stop();
    }, short ? 1400 : silenceMs);
  };

  const begin = () => {
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
      const done = finals.current.join(' ');
      setFinalText(done);
      setInterim(live.trim());
      armSilence();
    };
    rec.onerror = (event: any) => {
      const code = event?.error;
      if (code === 'aborted') return;
      if (code === 'no-speech' && (heardSomething.current || (wanted.current && restarts.current < 2 && !short))) return;
      if (ERRORS[code]) setError(ERRORS[code]);
      wanted.current = false;
    };
    rec.onend = () => {
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

  const start = useCallback(async () => {
    if (!recognitionClass()) {
      setError('Voice input works in Chrome, Edge and Safari. In this browser, please type the task instead.');
      return;
    }
    if (wanted.current) return;
    setError(null);
    setInterim('');
    setFinalText('');
    finals.current = [];
    delivered.current = false;
    heardSomething.current = false;
    restarts.current = 0;
    wanted.current = true;
    setStatus('listening');

    if (!(await startMeter())) {
      wanted.current = false;
      setStatus('idle');
      return;
    }

    maxTimer.current = window.setTimeout(() => stop(), short ? 8000 : maxMs);
    armSilence();
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, short, maxMs, silenceMs]);

  /** Stop listening and use what was said. */
  const stop = useCallback(() => {
    if (!wanted.current && !recognition.current) return;
    wanted.current = false;
    setStatus('finishing');
    clearTimers();
    try { recognition.current?.stop(); } catch { finish(); }
    // Some browsers never fire `end` after stop(); don't hang.
    window.setTimeout(() => finish(), 1500);
  }, [finish]);

  /** Stop listening and throw away what was said. */
  const cancel = useCallback(() => {
    delivered.current = true;
    wanted.current = false;
    try { recognition.current?.abort(); } catch { /* already stopped */ }
    finish();
  }, [finish]);

  useEffect(() => () => {
    delivered.current = true;
    wanted.current = false;
    try { recognition.current?.abort(); } catch { /* ignore */ }
    clearTimers();
    stopMeter();
  }, []);

  return { status, interim, finalText, error, level, start, stop, cancel, setError, supported: speechSupported() };
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
