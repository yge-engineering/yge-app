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
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const SEVERITY_TONE: Record<Flag['severity'], string> = {
  HIGH: 'border-red-300 bg-red-50 text-red-900',
  MEDIUM: 'border-amber-300 bg-amber-50 text-amber-900',
  LOW: 'border-gray-300 bg-gray-50 text-gray-800',
};
const READINESS_TONE: Record<ReviewResult['readiness'], string> = {
  HIGH: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-red-100 text-red-800',
};

export function BidReviewButton({ estimateId }: { estimateId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setError(null);
    setBusy(true);
    setOpen(true);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/priced-estimates/${estimateId}/review`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Review failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as ReviewResult;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? 'Reviewing…' : '🔍 AI bid review'}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-md bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Pre-submit AI review
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                ✕ Close
              </button>
            </header>
            {busy ? (
              <p className="mt-3 text-sm text-gray-600">
                Reading the estimate…
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                {error}
              </p>
            ) : null}
            {result ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${READINESS_TONE[result.readiness]}`}
                  >
                    Readiness: {result.readiness}
                  </span>
                  <p className="flex-1 text-sm text-gray-800">
                    {result.summary}
                  </p>
                </div>

                {result.flags.length > 0 ? (
                  <section className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Flags
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {result.flags.map((f, i) => (
                        <li
                          key={i}
                          className={`rounded border p-2 text-sm ${SEVERITY_TONE[f.severity]}`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                            {f.severity} · {f.category}
                            {f.itemNumber ? ` · item ${f.itemNumber}` : ''}
                          </span>
                          <div className="mt-0.5">{f.message}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <p className="mt-4 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
                    No flags raised. ✓
                  </p>
                )}

                {result.suggestions.length > 0 ? (
                  <section className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Suggestions
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {result.suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="rounded border border-yge-blue-200 bg-yge-blue-50 p-2 text-sm text-yge-blue-900"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">
                            {s.category}
                            {s.itemNumber ? ` · item ${s.itemNumber}` : ''}
                          </span>
                          <div className="mt-0.5">{s.message}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
                  >
                    Got it
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
