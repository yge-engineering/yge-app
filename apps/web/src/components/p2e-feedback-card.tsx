'use client';

// P2eFeedbackCard — thumbs / mixed verdict + reviewer note for an
// AI-drafted priced estimate. POSTs to /api/p2e-feedback so future
// prompt versions can be evaluated against past human verdicts.
//
// Hidden when the estimate didn't come from a draft (manual rows
// don't carry an aiPromptVer, so there's no AI prediction to rate).

import { useState } from 'react';

type Kind = 'good' | 'bad' | 'mixed';

interface Props {
  apiBaseUrl: string;
  estimateId: string;
  draftId?: string;
  promptVersion?: string;
  /** Email of the current reviewer (for cohort analysis). */
  byEmail?: string;
}

export function P2eFeedbackCard({
  apiBaseUrl,
  estimateId,
  draftId,
  promptVersion,
  byEmail,
}: Props) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/p2e-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId,
          ...(draftId ? { draftId } : {}),
          ...(promptVersion ? { promptVersion } : {}),
          ...(byEmail ? { byEmail } : {}),
          kind,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
        Thanks — feedback recorded for prompt {promptVersion ?? '(unspecified)'}. It'll
        roll into the next AI accuracy pass.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          AI draft accuracy
        </h3>
        <span className="text-xs text-gray-500">
          Prompt {promptVersion ?? '(none)'}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Was the AI draft useful? Pick a verdict and (optionally) tell us why so
        the next prompt version can avoid the same mistake.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['good', 'mixed', 'bad'] as Kind[]).map((k) => {
          const tone =
            k === 'good'
              ? kind === 'good'
                ? 'border-green-700 bg-green-50 text-green-900'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              : k === 'bad'
                ? kind === 'bad'
                  ? 'border-red-700 bg-red-50 text-red-900'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                : kind === 'mixed'
                  ? 'border-amber-700 bg-amber-50 text-amber-900'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50';
          const label =
            k === 'good' ? '👍 Good draft' : k === 'bad' ? '👎 Bad draft' : '🤔 Mixed';
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${tone}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {kind && (
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What did the AI get wrong (or right)? Optional."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {error && (
            <div className="mt-2 text-xs text-red-700">{error}</div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Submit feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
