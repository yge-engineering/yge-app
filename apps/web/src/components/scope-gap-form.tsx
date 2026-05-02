// Scope-gap form — paste spec text, run AI check, render report.

'use client';

import { useState } from 'react';
import {
  computeScopeGapRollup,
  sortGaps,
  type ScopeGap,
  type ScopeGapReport,
  type ScopeGapSeverity,
} from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  draftJson: string;
  itemCount: number;
}

interface RunResponse {
  report: ScopeGapReport;
  modelUsed: string;
  promptVersion: string;
  durationMs: number;
}

const SEVERITY_TONE: Record<ScopeGapSeverity, string> = {
  HIGH: 'border-red-300 bg-red-50',
  MEDIUM: 'border-amber-300 bg-amber-50',
  LOW: 'border-gray-300 bg-gray-50',
};

const SEVERITY_BADGE: Record<ScopeGapSeverity, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-gray-200 text-gray-800',
};

export function ScopeGapForm({ apiBaseUrl, draftJson, itemCount }: Props) {
  const [specText, setSpecText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RunResponse | null>(null);

  const ready = specText.trim().length >= 100;

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/plans-to-estimate/scope-gap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftJson, specText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Scope-gap check failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as RunResponse;
      setResponse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Paste the technical specification text
        </span>
        <textarea
          value={specText}
          onChange={(e) => setSpecText(e.target.value)}
          rows={14}
          placeholder="Paste the spec section here — Caltrans Std Specs, county ATC packet, project-specific specs, etc."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
        />
        <span className="mt-1 block text-xs text-gray-500">
          {specText.length.toLocaleString()} chars · AI runs against this draft of{' '}
          {itemCount} items.
        </span>
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!ready || busy}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running scope-gap check…' : 'Run scope-gap check'}
        </button>
        {!ready && specText.length > 0 && (
          <span className="text-xs text-amber-700">
            Paste at least 100 characters before running.
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {response && <ReportView response={response} />}
    </section>
  );
}

function ReportView({ response }: { response: RunResponse }) {
  const sorted = sortGaps(response.report.gaps);
  const rollup = computeScopeGapRollup(response.report);

  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Scope-gap report
        </h2>
        <span className="text-xs font-mono text-gray-500">
          {response.modelUsed} · {response.promptVersion} · {(response.durationMs / 1000).toFixed(1)}s
        </span>
      </header>

      <div
        className={`rounded-md border p-3 text-sm ${
          response.report.overallStatus === 'CLEAN'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
            : response.report.overallStatus === 'MINOR_GAPS'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-red-300 bg-red-50 text-red-900'
        }`}
      >
        <strong>{response.report.overallStatus.replace('_', ' ')}</strong>
        {' — '}
        {rollup.total} gap{rollup.total === 1 ? '' : 's'}{' '}
        ({rollup.bySeverity.HIGH} HIGH · {rollup.bySeverity.MEDIUM} MEDIUM · {rollup.bySeverity.LOW} LOW)
        {response.report.summary && (
          <p className="mt-1 text-sm">{response.report.summary}</p>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="mt-3 space-y-3">
          {sorted.map((g, i) => (
            <li key={i} className={`rounded-md border p-3 ${SEVERITY_TONE[g.severity]}`}>
              <GapRow gap={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GapRow({ gap }: { gap: ScopeGap }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[gap.severity]}`}
        >
          {gap.severity}
        </span>
        <span className="text-xs uppercase tracking-wide text-gray-500">{gap.category}</span>
      </div>
      <p className="text-sm text-gray-900">{gap.message}</p>
      {gap.specReference && (
        <p className="mt-1 text-xs italic text-gray-700">Spec: {gap.specReference}</p>
      )}
      {(gap.suggestedItemNumber || gap.suggestedDescription || gap.existingItemNumber) && (
        <div className="mt-2 rounded border border-white bg-white/60 p-2 text-xs text-gray-700">
          {gap.existingItemNumber ? (
            <span>
              Adjust item <strong>{gap.existingItemNumber}</strong>:
              {gap.suggestedQuantity != null && ` qty -> ${gap.suggestedQuantity}`}
              {gap.suggestedUnit && ` (${gap.suggestedUnit})`}
            </span>
          ) : (
            <span>
              Add{' '}
              <strong>{gap.suggestedItemNumber ?? '(new line)'}</strong>:{' '}
              {gap.suggestedDescription ?? ''}
              {gap.suggestedQuantity != null && ` — qty ${gap.suggestedQuantity}`}
              {gap.suggestedUnit && ` ${gap.suggestedUnit}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
