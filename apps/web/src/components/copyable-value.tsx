'use client';

// CopyableValue — small "click to copy" widget for bid-day.
//
// On bid day the estimator usually has to paste the bid total
// (and maybe the bid security amount, project name, etc.) into
// the agency's web bid form. Surfacing those values with a
// dedicated copy button beats Cmd+A → Cmd+C through the page.
//
// The copy value (`clipboard`) often differs from what's shown
// on screen — e.g. label says "$1,234,567" but we want to copy
// "1234567" so the bid form's number input accepts it. Caller
// supplies both.

import { useState } from 'react';

interface Props {
  /** What the user sees as the value. */
  label: string;
  /** What lands on the clipboard. */
  clipboard: string;
  /** Tiny caption above the value (e.g. "Bid total"). */
  caption?: string;
  /** Optional tooltip for the copy button. */
  copyTitle?: string;
}

export function CopyableValue({ label, clipboard, caption, copyTitle }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setState('failed');
      return;
    }
    try {
      await navigator.clipboard.writeText(clipboard);
      setState('copied');
      window.setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('failed');
      window.setTimeout(() => setState('idle'), 2000);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {caption && (
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            {caption}
          </div>
        )}
        <div className="truncate text-sm font-semibold tabular-nums text-gray-900">
          {label}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title={copyTitle ?? 'Copy to clipboard'}
        className={`whitespace-nowrap rounded border px-2 py-1 text-[11px] font-semibold transition ${
          state === 'copied'
            ? 'border-green-500 bg-green-50 text-green-800'
            : state === 'failed'
              ? 'border-red-500 bg-red-50 text-red-800'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {state === 'copied'
          ? '✓ Copied'
          : state === 'failed'
            ? 'Copy failed'
            : 'Copy'}
      </button>
    </div>
  );
}
