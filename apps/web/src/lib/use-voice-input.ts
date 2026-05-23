'use client';

// Web Speech API → React hook.
//
// Returns `start`, `stop`, `listening`, `transcript`, `supported`,
// and `error`. Pure client. Falls back gracefully when the browser
// doesn't expose SpeechRecognition (Firefox / old Safari).
//
// Usage:
//   const v = useVoiceInput({ lang: 'en-US', onFinal: (text) => setValue(text) });
//   <button onClick={v.listening ? v.stop : v.start} disabled={!v.supported}>
//     {v.listening ? '◼' : '🎙'}
//   </button>

import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API isn't part of the standard DOM lib yet, so the
// types live here. Vendor-prefixed `webkitSpeechRecognition` is what
// Chrome / Edge / current Safari expose.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function pickCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceInputOptions {
  /** BCP-47 tag — 'en-US', 'es-MX', etc. */
  lang?: string;
  /** Called once when recognition delivers a final result. */
  onFinal?: (text: string) => void;
  /** Called on every interim partial. Optional. */
  onInterim?: (text: string) => void;
}

export interface UseVoiceInputResult {
  supported: boolean;
  listening: boolean;
  /** Most recent final transcript, or '' before any. */
  transcript: string;
  /** Most recent interim (live) transcript, or ''. */
  interim: string;
  /** Last error message, or null. */
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const ctor = pickCtor();
  const supported = ctor !== null;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  const start = useCallback(() => {
    if (!ctor) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    if (recRef.current) recRef.current.abort();
    setError(null);
    setTranscript('');
    setInterim('');

    const rec = new ctor();
    rec.lang = optsRef.current.lang ?? 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let finalSoFar = '';
      let interimSoFar = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalSoFar += text;
        else interimSoFar += text;
      }
      if (finalSoFar) {
        setTranscript((prev) => prev + finalSoFar);
        setInterim('');
        optsRef.current.onFinal?.(finalSoFar);
      }
      if (interimSoFar) {
        setInterim(interimSoFar);
        optsRef.current.onInterim?.(interimSoFar);
      }
    };
    rec.onerror = (e) => {
      setError(e.message || e.error || 'Recognition error');
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    try {
      rec.start();
      setListening(true);
      recRef.current = rec;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recognition');
      setListening(false);
    }
  }, [ctor]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  // Tidy up if the component unmounts mid-recognition.
  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported, listening, transcript, interim, error, start, stop };
}
