// Expand bullet-list to prose for the daily report.
// Plain English: foreman pastes 3 bullets, hits the button, gets
// a 2-4 sentence paragraph back the office can hand to the agency.

'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface NarrativeExpandButtonProps {
  /** Current value of the textarea — bullet points or notes. */
  value: string;
  /** Replace the textarea contents with the expanded prose. */
  onApply: (next: string) => void;
  /** Optional context the prompt can use ("Sulphur Springs Road"). */
  jobName?: string;
  date?: string;
}

export function NarrativeExpandButton(props: NarrativeExpandButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function bulletsFromText(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
      .filter((l) => l.length > 0);
  }

  async function onClick() {
    setError(null);
    setPreview(null);
    const bullets = bulletsFromText(props.value);
    if (bullets.length === 0) {
      setError('Type a few bullet points first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/daily-reports/narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bullets,
          jobName: props.jobName,
          date: props.date,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Expand failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { narrative: string };
      setPreview(body.narrative);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={busy || props.value.trim().length === 0}
          className="rounded border border-yge-blue-500 bg-white px-3 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50"
        >
          {busy ? 'Expanding…' : 'Expand to prose (AI)'}
        </button>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
      {preview ? (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="whitespace-pre-line text-gray-900">{preview}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700"
              onClick={() => {
                props.onApply(preview);
                setPreview(null);
              }}
            >
              Use this
            </button>
            <button
              type="button"
              className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => setPreview(null)}
            >
              Discard
            </button>
            <span className="text-xs text-gray-500">
              Edit the textarea above to refine before saving.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
