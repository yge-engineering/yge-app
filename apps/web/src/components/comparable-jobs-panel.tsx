// ComparableJobsPanel — "this draft looks like..." reality check
// on /drafts/[id]. Server component.
//
// Given a Plans-to-Estimate draft, finds the top 3 past YGE jobs
// that look most like it (same project type / scope keywords /
// county) and prints them with the bid-vs-actual variance and
// the lessons-learned note. The estimator scans this BEFORE
// converting the draft to an estimate — if a similar prior job
// missed by 4×, that's the moment to slow down.
//
// Data source today: a hand-curated seed (YGE_JOB_HISTORY_SEED).
// Eventually swaps for a DB-backed query.

import {
  bidVsActualVariance,
  bidVsLowVariance,
  findComparableJobs,
  formatUSD,
  type PtoEOutput,
} from '@yge/shared';

import {
  YGE_JOB_HISTORY_SEED,
  extractScopeKeywordsFromText,
} from '../lib/yge-job-history-seed';

interface Props {
  draft: PtoEOutput;
}

export function ComparableJobsPanel({ draft }: Props) {
  const scopeText = [
    draft.projectName,
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');
  const scopeKeywords = extractScopeKeywordsFromText(scopeText);

  const matches = findComparableJobs(
    {
      projectType: draft.projectType,
      scopeKeywords,
      countyName: draft.locationCounty ?? null,
    },
    [...YGE_JOB_HISTORY_SEED],
    { maxResults: 3 },
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">
          Past jobs like this one
        </h2>
        <p className="text-xs text-gray-500">
          Sanity check before you submit. Matched on project type, scope, and
          county.
        </p>
      </header>

      {matches.length === 0 ? (
        <EmptyState
          seedCount={YGE_JOB_HISTORY_SEED.length}
          extractedKeywords={scopeKeywords}
          projectType={draft.projectType}
          county={draft.locationCounty ?? null}
        />
      ) : (
        <ul className="divide-y divide-gray-200">
          {matches.map((m) => (
            <ComparableRow key={m.job.id} match={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({
  seedCount,
  extractedKeywords,
  projectType,
  county,
}: {
  seedCount: number;
  extractedKeywords: string[];
  projectType: PtoEOutput['projectType'];
  county: string | null;
}) {
  return (
    <div className="space-y-3 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-700">
      <p>
        No past YGE jobs match this draft closely enough yet.{' '}
        {seedCount === 0
          ? 'The comparables library is empty — populate it from /drafts admin or via DB seed.'
          : `${seedCount} past job${seedCount === 1 ? '' : 's'} on file, but none scored ≥40 against this draft.`}
      </p>
      <details>
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
          What the matcher tried
        </summary>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="font-semibold text-gray-600">Project type</dt>
          <dd className="text-gray-800">{projectType}</dd>
          <dt className="font-semibold text-gray-600">County</dt>
          <dd className="text-gray-800">{county ?? '— (not extracted from draft)'}</dd>
          <dt className="font-semibold text-gray-600">Scope keywords</dt>
          <dd className="text-gray-800">
            {extractedKeywords.length === 0
              ? '— (dictionary did not match any bid-item descriptions)'
              : extractedKeywords.join(', ')}
          </dd>
        </dl>
      </details>
    </div>
  );
}

function ComparableRow({
  match,
}: {
  match: ReturnType<typeof findComparableJobs>[number];
}) {
  const { job, similarityScore, reasons } = match;
  const actualV = bidVsActualVariance(job);
  const lowV = bidVsLowVariance(job);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {job.projectName}
          </div>
          <div className="text-xs text-gray-500">
            {job.ownerAgency ? `${job.ownerAgency} · ` : ''}
            Bid {formatUSD(job.bidTotalCents, { compact: true })}
            {job.actualCostCents !== null && (
              <>
                {' '}
                · Actual {formatUSD(job.actualCostCents, { compact: true })}
              </>
            )}
          </div>
        </div>
        <SimilarityChip score={similarityScore} />
      </div>

      {(actualV || lowV) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {actualV && (
            <VarianceChip
              label={actualV.label}
              tone={
                Math.abs(actualV.pctDeltaPercent) <= 10
                  ? 'good'
                  : Math.abs(actualV.pctDeltaPercent) <= 25
                    ? 'warn'
                    : 'bad'
              }
            />
          )}
          {lowV && (
            <VarianceChip
              label={lowV.label}
              tone={
                lowV.pctDeltaPercent <= 5 && lowV.pctDeltaPercent >= -5
                  ? 'good'
                  : 'warn'
              }
            />
          )}
        </div>
      )}

      {reasons.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-gray-700">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {job.notesForFuture && (
        <p className="mt-2 rounded bg-yellow-50 p-2 text-xs text-yellow-900">
          <span className="font-semibold">Lessons:</span> {job.notesForFuture}
        </p>
      )}
    </li>
  );
}

function SimilarityChip({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 60
        ? 'bg-yellow-100 text-yellow-900'
        : 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {score}% match
    </span>
  );
}

function VarianceChip({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const cls =
    tone === 'good'
      ? 'border-green-300 bg-green-50 text-green-800'
      : tone === 'warn'
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-red-300 bg-red-50 text-red-800';
  return (
    <span className={`rounded border px-2 py-0.5 ${cls}`}>{label}</span>
  );
}
