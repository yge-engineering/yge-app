'use client';

// Button + popover that runs the AI addenda-vs-bid-items
// cross-check and renders the issues list.

import { useState } from 'react';

interface Issue {
  itemIndex: number | null;
  addendumNumber?: string;
  severity: 'blocker' | 'warn' | 'info';
  message: string;
}

interface Props {
  apiBaseUrl: string;
  estimateId: string;
}

export function CrossCheckAddendaButton({ apiBaseUrl, estimateId }: Props) {
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setIssues(null);
    setOpen(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${encodeURIComponent(estimateId)}/cross-check-addenda`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { issues: Issue[] };
      setIssues(json.issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cross-check failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded border border-yge-blue-500 bg-white px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-60"
        title="Ask the AI to cross-check addenda against the bid items"
      >
        {busy ? 'Checking…' : '🔎 Cross-check addenda'}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-96 rounded-md border border-gray-300 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-semibold text-gray-900">
              Cross-check results
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              ✕
            </button>
          </header>
          <div className="max-h-72 overflow-y-auto p-2 text-xs">
            {busy && <div className="italic text-gray-500">Asking the model…</div>}
            {error && <div className="text-red-700">⚠ {error}</div>}
            {issues != null && issues.length === 0 && (
              <div className="rounded border border-green-300 bg-green-50 px-2 py-1.5 text-green-800">
                ✓ Addenda look fully reconciled.
              </div>
            )}
            {issues != null && issues.length > 0 && (
              <ul className="space-y-2">
                {issues.map((iss, idx) => {
                  const tone =
                    iss.severity === 'blocker'
                      ? 'border-red-300 bg-red-50 text-red-900'
                      : iss.severity === 'warn'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-gray-300 bg-gray-50 text-gray-800';
                  return (
                    <li key={idx} className={`rounded border px-2 py-1.5 ${tone}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wide">
                          {iss.severity}
                          {iss.addendumNumber
                            ? ` · Addendum ${iss.addendumNumber}`
                            : ''}
                          {iss.itemIndex != null
                            ? ` · Item index ${iss.itemIndex}`
                            : ''}
                        </span>
                      </div>
                      <p className="mt-0.5">{iss.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
