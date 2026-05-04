// Multi-pass PtoE form. Three textareas, one Run button.

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslator, type Translator } from '../lib/use-translator';
import type { PtoEOutput } from '@yge/shared';

interface Props {
  apiBaseUrl: string;
}

interface PerPassUsage {
  inputTokens: number;
  outputTokens: number;
  promptVersion: string;
}

interface RunResponse {
  output: PtoEOutput;
  modelUsed: string;
  passes: {
    titleBlock: PerPassUsage;
    bidSchedule: PerPassUsage;
    specExtras?: PerPassUsage;
  };
  durationMs: number;
  savedId?: string;
}

export function MultiPassPlansToEstimateForm({ apiBaseUrl }: Props) {
  const t = useTranslator();
  const [jobId, setJobId] = useState('');
  const [titleBlockText, setTitleBlockText] = useState('');
  const [bidScheduleText, setBidScheduleText] = useState('');
  const [specText, setSpecText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const ready =
    /^job-[a-z0-9-]{10,80}$/.test(jobId) &&
    titleBlockText.trim().length >= 20 &&
    bidScheduleText.trim().length >= 20;

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/plans-to-estimate/multipass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          titleBlockText,
          bidScheduleText,
          ...(specText.trim().length >= 20 ? { specText } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('mpe.errFail', { status: res.status }));
        return;
      }
      const json = (await res.json()) as RunResponse;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <Field label={t('mpe.lblJobId')} hint={t('mpe.hintJobId')}>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value.trim())}
            placeholder={t('mpe.phJobId')}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
        </Field>

        <Field label={t('mpe.lblTitleBlock')}>
          <textarea
            value={titleBlockText}
            onChange={(e) => setTitleBlockText(e.target.value)}
            rows={6}
            placeholder={t('mpe.phTitleBlock')}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
          <span className="mt-1 block text-xs text-gray-500">
            {t('mpe.charsHint', { count: titleBlockText.length.toLocaleString() })}
          </span>
        </Field>

        <Field label={t('mpe.lblBidSchedule')} hint={t('mpe.hintBidSchedule')}>
          <textarea
            value={bidScheduleText}
            onChange={(e) => setBidScheduleText(e.target.value)}
            rows={10}
            placeholder="Item 1. Mobilization · LS · 1
Item 2. Clearing & Grubbing · ACRE · 12
Item 3. Roadway Excavation · CY · 4500
..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
          <span className="mt-1 block text-xs text-gray-500">
            {t('mpe.charsHint', { count: bidScheduleText.length.toLocaleString() })}
          </span>
        </Field>

        <Field label={t('mpe.lblSpec')} hint={t('mpe.hintSpec')}>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={10}
            placeholder="Section 02 — Earthwork
Section 13 — Special conditions
..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
          <span className="mt-1 block text-xs text-gray-500">
            {t('mpe.charsHint', { count: specText.length.toLocaleString() })}
          </span>
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!ready || busy}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('mpe.busy') : t('mpe.action')}
          </button>
          {!ready && (jobId || titleBlockText) && (
            <span className="text-xs text-amber-700">
              {t('mpe.notReady')}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {!result ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
            {t('mpe.outputPlaceholder')}
          </div>
        ) : (
          <ResultPanel result={result} t={t} />
        )}
      </section>
    </div>
  );
}

function ResultPanel({ result, t }: { result: RunResponse; t: Translator }) {
  return (
    <div className="space-y-4 text-sm">
      <header className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
        <strong>{result.output.projectName}</strong> · {t('mpe.itemsCount', { count: result.output.bidItems.length })} ·
        {t('mpe.confidence', { level: result.output.overallConfidence })}
        <div className="mt-1 text-xs">
          {t('mpe.runStats', { seconds: (result.durationMs / 1000).toFixed(1), model: result.modelUsed })} · {result.passes.specExtras ? t('mpe.passes3') : t('mpe.passes2')}
        </div>
      </header>

      <section className="rounded border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('mpe.metadataHeader')}
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-gray-500">{t('mpe.lblType')}</dt>
          <dd className="font-mono">{result.output.projectType}</dd>
          {result.output.location && (
            <>
              <dt className="text-gray-500">{t('mpe.lblLocation')}</dt>
              <dd>{result.output.location}</dd>
            </>
          )}
          {result.output.ownerAgency && (
            <>
              <dt className="text-gray-500">{t('mpe.lblAgency')}</dt>
              <dd>{result.output.ownerAgency}</dd>
            </>
          )}
          {result.output.bidDueDate && (
            <>
              <dt className="text-gray-500">{t('mpe.lblBidDue')}</dt>
              <dd className="font-mono">{result.output.bidDueDate}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="rounded border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('mpe.bidItemsHeader')}
        </h3>
        <ul className="space-y-1 text-xs">
          {result.output.bidItems.map((b, i) => (
            <li key={i} className="border-b border-gray-100 pb-1">
              <span className="font-mono text-gray-700">{b.itemNumber}.</span>{' '}
              {b.description} · {b.quantity} {b.unit}
              {b.confidence !== 'HIGH' && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                  {b.confidence}
                </span>
              )}
              {b.itemNumber.startsWith('X.') && (
                <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] uppercase text-blue-800">
                  {t('mpe.specExtraBadge')}
                </span>
              )}
              {b.notes && <div className="text-gray-500 italic">{b.notes}</div>}
            </li>
          ))}
        </ul>
      </section>

      {(result.output.assumptions ?? []).length > 0 && (
        <section className="rounded border border-gray-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('mpe.assumptionsHeader')}
          </h3>
          <ul className="list-disc pl-5 text-xs">
            {result.output.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {(result.output.questionsForEstimator ?? []).length > 0 && (
        <section className="rounded border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t('mpe.questionsHeader')}
          </h3>
          <ul className="list-disc pl-5 text-xs text-amber-900">
            {result.output.questionsForEstimator.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <h3 className="mb-1 font-semibold uppercase tracking-wide text-gray-500">
          {t('mpe.usageHeader')}
        </h3>
        <ul className="space-y-0.5 font-mono">
          <li>
            title-block: {result.passes.titleBlock.inputTokens} in /{' '}
            {result.passes.titleBlock.outputTokens} out · {result.passes.titleBlock.promptVersion}
          </li>
          <li>
            bid-schedule: {result.passes.bidSchedule.inputTokens} in /{' '}
            {result.passes.bidSchedule.outputTokens} out · {result.passes.bidSchedule.promptVersion}
          </li>
          {result.passes.specExtras && (
            <li>
              spec-extras: {result.passes.specExtras.inputTokens} in /{' '}
              {result.passes.specExtras.outputTokens} out · {result.passes.specExtras.promptVersion}
            </li>
          )}
        </ul>
      </section>

      {result.savedId && (
        <Link
          href={`/drafts/${result.savedId}`}
          className="block rounded bg-yge-blue-500 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-yge-blue-700"
        >
          {t('mpe.openDraft')}
        </Link>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
