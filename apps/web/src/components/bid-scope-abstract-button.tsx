// On-demand AI generator for the 2-3 sentence bid scope abstract.
//
// Plain English: button that asks Claude to write a short
// "what YGE is bidding" paragraph from the priced estimate
// (project name + top bid items + agency). Lets Ryan copy the
// result straight into the cover letter body, a clarification
// email, or the bid-board.
//
// Sits on /estimates/[id]/transmittal — companion to the existing
// auto-built transmittal letter. Doesn't replace the letter;
// it generates one paragraph that the operator pastes wherever
// they need it.

'use client';

import { useState } from 'react';

interface Props {
  estimateId: string;
  apiBaseUrl: string;
}

interface Result {
  abstract: string;
  promptVersion?: string;
}

export function BidScopeAbstractButton({ estimateId, apiBaseUrl }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimateId}/scope-abstract`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          typeof body === 'object' && body && 'error' in body
            ? String((body as { error: unknown }).error)
            : `API returned ${res.status}`,
        );
        return;
      }
      setResult((await res.json()) as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function copyToClipboard() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.abstract);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm no-print">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            AI scope abstract
          </h2>
          <p className="text-[11px] text-gray-500">
            One-paragraph &quot;what we&apos;re bidding&quot; for the cover
            letter body or a clarification email. ≈ 10–20s per click.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {running
            ? 'Generating…'
            : result
              ? 'Regenerate'
              : 'Generate abstract'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-900">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-900">
          {result.abstract}
          <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
            <span className="font-mono uppercase tracking-wide text-gray-500">
              {result.promptVersion ?? ''}
            </span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded border border-gray-300 px-2 py-0.5 font-semibold text-gray-700 hover:bg-gray-100"
            >
              {copied ? 'Copied!' : 'Copy text'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
