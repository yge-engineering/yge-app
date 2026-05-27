// /comparables — table view of the YGE_JOB_HISTORY_SEED.
//
// Lets Ryan audit / sort / spot-check the comparable jobs that
// feed the AI prompt's reality-check section and the per-draft
// + bid-day cockpit panels. Each row shows what each entry
// contributes: bid total, actual cost, variance, county,
// keyword count, "template?" flag.
//
// Today the data is static. When a DB-backed seed lands, the
// fetch swaps from import to /api call.

import Link from 'next/link';

import {
  AppShell,
  PageHeader,
} from '../../components';
import {
  bidVsActualVariance,
  formatUSD,
} from '@yge/shared';

import { YGE_JOB_HISTORY_SEED } from '../../lib/yge-job-history-seed';

// Six PtoEProjectType values; coverage tile shows how many are
// represented in the seed. Keep this list in sync with
// packages/shared/src/plans-to-estimate-output.ts.
const ALL_PROJECT_TYPES = [
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
] as const;

export default function ComparablesAuditPage() {
  const rows = YGE_JOB_HISTORY_SEED.map((j) => ({
    job: j,
    isTemplate:
      j.id.startsWith('template-') || j.projectName.startsWith('TEMPLATE'),
    variance: bidVsActualVariance(j),
  }))
    // Most-recent jobs first — that's what an estimator scanning
    // the audit table typically wants. Stable for entries with
    // missing/equal bidAt (slice() above clones, sort() is stable
    // in modern V8).
    .slice()
    .sort((a, b) => (b.job.bidAt ?? '').localeCompare(a.job.bidAt ?? ''));

  const realCount = rows.filter((r) => !r.isTemplate).length;
  const templateCount = rows.filter((r) => r.isTemplate).length;

  const coveredTypes = new Set(rows.map((r) => r.job.projectType));
  const missingTypes = ALL_PROJECT_TYPES.filter((t) => !coveredTypes.has(t));
  const coverageValue = `${coveredTypes.size} / ${ALL_PROJECT_TYPES.length}`;
  const coverageTone: 'ok' | 'warn' =
    coveredTypes.size === ALL_PROJECT_TYPES.length ? 'ok' : 'warn';

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6 sm:p-8">
        <PageHeader
          title="Comparables audit"
          subtitle="Static seed today (apps/web/src/lib/yge-job-history-seed.ts). Used by the comparables panel on /drafts/[id] + the bid-day cockpit + the AI prompt reality check."
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={String(rows.length)} />
          <Tile label="Real" value={String(realCount)} tone="ok" />
          <Tile label="Templates" value={String(templateCount)} tone="warn" />
          <Tile
            label="Archetypes"
            value={coverageValue}
            tone={coverageTone}
            footnote={
              missingTypes.length === 0
                ? 'all 6 covered'
                : `missing: ${missingTypes.join(', ')}`
            }
          />
        </section>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs text-gray-600">
            To add a real comparable: edit{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">
              apps/web/src/lib/yge-job-history-seed.ts
            </code>
            . Replace a TEMPLATE entry in place, or append a new entry
            following the same schema. Then ship a bundle.
          </p>
          <a
            href="/comparables/export.csv"
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </a>
        </div>

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Project</th>
                <th className="px-3 py-2 text-left">Agency</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">County</th>
                <th className="px-3 py-2 text-right">Bid</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-left">Variance</th>
                <th className="px-3 py-2 text-right">Keywords</th>
                <th className="px-3 py-2 text-left">Bid date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ job, isTemplate, variance }) => (
                <tr
                  key={job.id}
                  className={isTemplate ? 'bg-amber-50/30 italic text-gray-700' : ''}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{job.projectName}</div>
                    {isTemplate && (
                      <span className="mt-0.5 inline-block rounded bg-amber-200 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-900">
                        template
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{job.ownerAgency ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{job.projectType}</td>
                  <td className="px-3 py-2 text-xs">{job.countyName ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatUSD(job.bidTotalCents, { compact: true })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {job.actualCostCents !== null
                      ? formatUSD(job.actualCostCents, { compact: true })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {variance ? (
                      <span
                        className={
                          Math.abs(variance.pctDeltaPercent) <= 10
                            ? 'text-green-700'
                            : Math.abs(variance.pctDeltaPercent) <= 25
                              ? 'text-yellow-700'
                              : 'text-red-700'
                        }
                      >
                        {variance.label}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {job.scopeKeywords.length}
                  </td>
                  <td className="px-3 py-2 text-xs">{job.bidAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-4 text-xs text-gray-500">
          See also:{' '}
          <Link href="/drafts" className="text-yge-blue-500 hover:underline">
            /drafts
          </Link>{' '}
          (comparables panel),{' '}
          <Link href="/dashboard/lite" className="text-yge-blue-500 hover:underline">
            /dashboard/lite
          </Link>{' '}
          (seed-status tile).
        </p>
      </main>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  tone,
  footnote,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
  footnote?: string;
}) {
  const cls =
    tone === 'ok'
      ? 'border-green-300 bg-green-50 text-green-900'
      : tone === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {footnote && (
        <div className="mt-1 text-[10px] opacity-70">{footnote}</div>
      )}
    </div>
  );
}
