'use client';

// Voice-input button — clip-on for any text input.
//
// Pass a controlled-input's setter as `onTranscript`. Each final
// transcript fragment is APPENDED to the existing value (with a
// space separator), so the user can dictate multiple short phrases
// into the same field.
//
// Default language tracks the current app locale ('en' → 'en-US',
// 'es' → 'es-MX'). Override via the `lang` prop for per-field tags.
//
// Renders a small icon button — '🎙' when idle, '◼' while listening.
// Disabled state with tooltip when the browser doesn't expose
// SpeechRecognition (currently Firefox + older Safari).

import { useVoiceInput } from '@/lib/use-voice-input';
import { useLocale } from '@/lib/use-translator';
import type { Locale } from '@yge/shared';

interface Props {
  /** BCP-47 language tag — defaults to the current app locale's
   *  natural tag ('en-US' / 'es-MX'). Override per-field as needed. */
  lang?: string;
  /** Current value of the input, so appends produce 'hello world'
   *  instead of 'helloworld'. */
  currentValue: string;
  /** Setter that receives the new full text. */
  onTranscript: (next: string) => void;
  /** Optional className override on the button. */
  className?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
}

const DEFAULT_BCP47_BY_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-MX',
};

export function VoiceButton({
  lang,
  currentValue,
  onTranscript,
  className,
  ariaLabel = 'Dictate input',
}: Props) {
  const locale = useLocale();
  const effectiveLang = lang ?? DEFAULT_BCP47_BY_LOCALE[locale];
  const v = useVoiceInput({
    lang: effectiveLang,
    onFinal: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const next = currentValue
        ? `${currentValue.replace(/\s+$/, '')} ${trimmed}`
        : trimmed;
      onTranscript(next);
    },
  });

  const title = !v.supported
    ? 'Voice input requires Chrome, Edge, or Safari.'
    : v.listening
      ? 'Stop dictation'
      : 'Dictate (Web Speech API)';

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => (v.listening ? v.stop() : v.start())}
        disabled={!v.supported}
        title={title}
        aria-label={ariaLabel}
        className={
          className ??
          `rounded border px-2 py-1 text-xs font-medium ${
            v.listening
              ? 'border-red-300 bg-red-50 text-red-800'
              : v.supported
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                : 'border-gray-200 bg-gray-50 text-gray-400'
          }`
        }
      >
        {v.listening ? '◼' : '🎙'}
      </button>
      {v.interim && (
        <span className="text-xs italic text-gray-500">{v.interim}</span>
      )}
      {v.error && (
        <span className="text-xs text-red-600">{v.error}</span>
      )}
    </div>
  );
}
