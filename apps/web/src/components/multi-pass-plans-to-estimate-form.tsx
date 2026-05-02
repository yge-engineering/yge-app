// Multi-pass PtoE form. Three textareas, one Run button.

'use client';

import Link from 'next/link';
import { useState } from 'react';
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
        setError(body.error ?? `Multipass failed (${res.status})`);
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
        <Field label="Job id" hint="Format: job-YYYY-MM-DD-slug-XXXXXXXX">
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value.trim())}
            placeholder="job-2026-04-15-sulphur-springs-aabb1122"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
        </Field>

        <Field label="Title block / front matter">
          <textarea
            value={titleBlockText}
            onChange={(e) => setTitleBlockText(e.target.value)}
            rows={6}
            placeholder="Project name, agency, due date, location, contract #..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
          />
          <span className="mt-1 block text-xs text-gray-500">
            {titleBlockText.length.toLocaleString()} chars
          </span>
        </Field>

        <Field label="Bid schedule" hint="The agency's numbered line-item table">
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
            {bidScheduleText.length.toLocaleString()} chars
          </span>
        </Field>

        <Field label="Specifications (optional)" hint="Spec-extras pass skipped when blank">
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
            {specText.length.toLocaleString()} chars
          </span>
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!ready || busy}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Running 3 passes…' : 'Run multi-pass'}
          </button>
          {!ready && (jobId || titleBlockText) && (
            <span className="text-xs text-amber-700">
              Needs job id + title block + bid schedule (each at least 20 chars).
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
            Output appears here once the orchestrator returns.
          </div>
        ) : (
          <ResultPanel result={result} />
        )}
      </section>
    </div>
  );
}

function ResultPanel({ result }: { result: RunResponse }) {
  return (
    <div className="space-y-4 text-sm">
      <header className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
        <strong>{result.output.projectName}</strong> · {result.output.bidItems.length} items ·
        confidence {result.output.overallConfidence}
        <div className="mt-1 text-xs">
          {(result.durationMs / 1000).toFixed(1)}s · {result.modelUsed} ·
          {' '}
          {result.passes.specExtras ? '3 passes' : '2 passes'}
        </div>
      </header>

      <section className="rounded border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Project metadata
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-gray-500">Type</dt>
          <dd className="font-mono">{result.output.projectType}</dd>
          {result.output.location && (
            <>
              <dt className="text-gray-500">Location</dt>
              <dd>{result.output.location}</dd>
            </>
          )}
          {result.output.ownerAgency && (
            <>
              <dt className="text-gray-500">Agency</dt>
              <dd>{result.output.ownerAgency}</dd>
            </>
          )}
          {result.output.bidDueDate && (
            <>
              <dt className="text-gray-500">Bid due</dt>
              <dd className="font-mono">{result.output.bidDueDate}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="rounded border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Bid items
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
                  spec extra
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
            Assumptions
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
            Questions for the estimator
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
          Per-pass usage
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
          Open the saved draft &rarr;
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
