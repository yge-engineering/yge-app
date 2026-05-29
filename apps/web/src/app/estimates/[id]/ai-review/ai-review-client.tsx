// Client-side trigger + result render for the AI bid review.
//
// Posts to /api/priced-estimates/:id/review on demand (not on page
// load — Anthropic calls cost money + take 10-30s). Renders the
// parsed result inline with severity-toned flag rows.

'use client';

import { useState } from 'react';

interface Flag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  itemNumber: string | null;
  message: string;
}
interface Suggestion {
  category: string;
  itemNumber: string | null;
  message: string;
}
interface ReviewResult {
  readiness: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  flags: Flag[];
  suggestions: Suggestion[];
  promptVersion?: string;
}

interface Props {
  estimateId: string;
  apiBaseUrl: string;
}

export function AiReviewClient({ estimateId, apiBaseUrl }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimateId}/review`,
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
      const json = (await res.json()) as ReviewResult;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-6">
      {!result && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm print:hidden">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-md bg-yge-blue-500 px-6 py-3 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {running ? 'Reviewing… (10–30s)' : 'Run AI review now'}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            One Anthropic call. Result lands inline below.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Review failed:</strong> {error}
          <div className="mt-2">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="rounded border border-red-500 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {result && <ReviewView result={result} onRerun={run} running={running} />}
    </section>
  );
}

function ReviewView({
  result,
  onRerun,
  running,
}: {
  result: ReviewResult;
  onRerun: () => void;
  running: boolean;
}) {
  const tone =
    result.readiness === 'HIGH'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : result.readiness === 'MEDIUM'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-red-300 bg-red-50 text-red-900';
  return (
    <div>
      <section className={`rounded-lg border p-4 ${tone}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Readiness: {result.readiness}
          </h2>
          <button
            type="button"
            onClick={onRerun}
            disabled={running}
            className="rounded border border-current px-2 py-1 text-[10px] font-semibold uppercase tracking-wide hover:opacity-80 print:hidden"
          >
            {running ? 'Re-running…' : 'Re-run'}
          </button>
        </div>
        <p className="mt-1 text-sm">{result.summary}</p>
      </section>

      {result.flags.length === 0 && result.suggestions.length === 0 && (
        <p className="mt-4 rounded-md border border-dashed border-gray-300 bg-white p-4 text-center text-sm italic text-gray-700">
          No flags, no suggestions. Reviewer thinks this bid looks clean —
          double-check with the human eye before sealing.
        </p>
      )}

      {result.flags.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">
            Flags ({result.flags.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {result.flags.map((f, i) => (
              <li
                key={`flag-${i}`}
                className={`rounded-md border bg-white p-3 shadow-sm ${
                  f.severity === 'HIGH'
                    ? 'border-red-300'
                    : f.severity === 'MEDIUM'
                      ? 'border-amber-300'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      f.severity === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : f.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-gray-500">{f.category}</span>
                  {f.itemNumber && (
                    <span className="font-mono text-gray-700">
                      · item {f.itemNumber}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-900">{f.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.suggestions.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">
            Suggestions ({result.suggestions.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {result.suggestions.map((s, i) => (
              <li
                key={`sug-${i}`}
                className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  {s.category}
                  {s.itemNumber && (
                    <span className="ml-1 font-mono">· item {s.itemNumber}</span>
                  )}
                </div>
                <p className="mt-1">{s.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.promptVersion && (
        <p className="mt-6 text-[10px] uppercase tracking-wide text-gray-500">
          Prompt {result.promptVersion}
        </p>
      )}
    </div>
  );
}
