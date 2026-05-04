// Scope-gap form — paste spec text, run AI check, render report.

'use client';

import { useState } from 'react';
import { useTranslator, type Translator } from '../lib/use-translator';
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
  const t = useTranslator();
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
        setError(body.error ?? t('scopeGap.errFail', { status: res.status }));
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
          {t('scopeGap.lblPasteSpec')}
        </span>
        <textarea
          value={specText}
          onChange={(e) => setSpecText(e.target.value)}
          rows={14}
          placeholder={t('scopeGap.phPasteSpec')}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
        />
        <span className="mt-1 block text-xs text-gray-500">
          {t('scopeGap.charsHint', { chars: specText.length.toLocaleString(), items: itemCount })}
        </span>
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!ready || busy}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('scopeGap.busy') : t('scopeGap.action')}
        </button>
        {!ready && specText.length > 0 && (
          <span className="text-xs text-amber-700">
            {t('scopeGap.minLengthHint')}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {response && <ReportView response={response} t={t} />}
    </section>
  );
}

function ReportView({ response, t }: { response: RunResponse; t: Translator }) {
  const sorted = sortGaps(response.report.gaps);
  const rollup = computeScopeGapRollup(response.report);

  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('scopeGap.reportTitle')}
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
        {rollup.total === 1
          ? t('scopeGap.gapOne')
          : t('scopeGap.gapMany', { count: rollup.total })}{' '}
        {t('scopeGap.severityBreakdown', {
          high: rollup.bySeverity.HIGH,
          medium: rollup.bySeverity.MEDIUM,
          low: rollup.bySeverity.LOW,
        })}
        {response.report.summary && (
          <p className="mt-1 text-sm">{response.report.summary}</p>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="mt-3 space-y-3">
          {sorted.map((g, i) => (
            <li key={i} className={`rounded-md border p-3 ${SEVERITY_TONE[g.severity]}`}>
              <GapRow gap={g} t={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GapRow({ gap, t }: { gap: ScopeGap; t: Translator }) {
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
        <p className="mt-1 text-xs italic text-gray-700">{t('scopeGap.specRef', { ref: gap.specReference })}</p>
      )}
      {(gap.suggestedItemNumber || gap.suggestedDescription || gap.existingItemNumber) && (
        <div className="mt-2 rounded border border-white bg-white/60 p-2 text-xs text-gray-700">
          {gap.existingItemNumber ? (
            <span>
              {t('scopeGap.adjustItem')} <strong>{gap.existingItemNumber}</strong>:
              {gap.suggestedQuantity != null && t('scopeGap.qtyArrow', { qty: gap.suggestedQuantity })}
              {gap.suggestedUnit && ` (${gap.suggestedUnit})`}
            </span>
          ) : (
            <span>
              {t('scopeGap.add')}{' '}
              <strong>{gap.suggestedItemNumber ?? t('scopeGap.newLine')}</strong>:{' '}
              {gap.suggestedDescription ?? ''}
              {gap.suggestedQuantity != null && t('scopeGap.qtyDash', { qty: gap.suggestedQuantity })}
              {gap.suggestedUnit && ` ${gap.suggestedUnit}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
