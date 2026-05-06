// /estimates — list every priced estimate (drafts + prices the user added).
//
// Server component: fetches the summary list at request time, no client JS
// needed for the index view.

import Link from 'next/link';

import { Alert, AppShell, Money } from '../../components';
import { bidDueCountdown, coerceLocale } from '@yge/shared';
import { cookies } from 'next/headers';
import { CopyEstimateLink } from '../../components/copy-estimate-link';
import { EstimatesSearchInput } from '../../components/estimates-search-input';
import { EstimatesSortHeaders } from '../../components/estimates-sort-headers';
import { EstimatesShortcutsChip } from '../../components/estimates-shortcuts-chip';
import { EstimatesStatusFilter } from '../../components/estimates-status-filter';
import { EstimatesDueWeekChip } from '../../components/estimates-due-week-chip';
import { getTranslator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';

interface EstimateSummary {
  id: string;
  fromDraftId: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  bidDueDate?: string;
  bidItemCount: number;
  pricedLineCount: number;
  unpricedLineCount: number;
  oppPercent: number;
  bidTotalCents: number;
  /** May be missing on summary entries written before the §4104 sub list
   *  feature shipped — treat undefined as 0 so the UI doesn't break. */
  subBidCount?: number;
  /** May be missing on summary entries written before the addendum tracking
   *  feature shipped — treat undefined as 0. */
  addendumCount?: number;
  /** Logged but un-acknowledged addenda. > 0 = bid is non-responsive. */
  unacknowledgedAddendumCount?: number;
  /** Workflow status — set by the toolbar buttons on /estimates/[id]. */
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  /** First-submit timestamp; pre-feature rows lack this field. */
  bidSubmittedAt?: string;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

// Browser-facing API URL — CSV downloads are fetched directly from the
// user's browser, so they need the public URL.
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEstimates(): Promise<EstimateSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { estimates: EstimateSummary[] };
  return json.estimates;
}

interface ImportedEstimateSummary {
  id: string;
  jobId?: string;
  jobNumber: string;
  projectName: string;
  client?: string;
  rateType: 'PW' | 'Private';
  bidPriceCents: number;
  directCostCents: number;
  oppMarkupCents: number;
  oppPercent: number;
  lines: unknown[];
  updatedAt: string;
}

async function fetchImported(): Promise<ImportedEstimateSummary[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { importedEstimates: ImportedEstimateSummary[] };
    return json.importedEstimates;
  } catch {
    return [];
  }
}

function countDueBuckets(rows: { bidDueDate?: string }[]): {
  overdue: number;
  dueSoon: number;
} {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let overdue = 0;
  let dueSoon = 0;
  for (const r of rows) {
    if (!r.bidDueDate) continue;
    const t = new Date(r.bidDueDate).getTime();
    if (Number.isNaN(t)) continue;
    const delta = t - now;
    if (delta < 0) overdue++;
    else if (delta <= sevenDays) dueSoon++;
  }
  return { overdue, dueSoon };
}

function urgencyKey(iso: string | undefined, now: number): number {
  // Smaller key = more urgent. Buckets the rows so:
  //   - overdue (negative deltas) sort top, most-overdue first
  //   - upcoming sort next, soonest first
  //   - missing due-date sort last
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  const delta = t - now;
  // Overdue: shift to a strictly-negative range so they always sort first.
  // Use the raw delta (already negative) so most-overdue float to the top.
  return delta;
}

function sortByUrgency<T extends { bidDueDate?: string; updatedAt: string }>(
  rows: T[],
): T[] {
  const now = Date.now();
  return [...rows].sort((a, b) => {
    const ua = urgencyKey(a.bidDueDate, now);
    const ub = urgencyKey(b.bidDueDate, now);
    if (ua !== ub) return ua - ub;
    // Tiebreaker: most-recently-updated first.
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return tb - ta;
  });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SubmittedAgePill({
  iso,
  status,
}: {
  iso: string | undefined;
  status: 'pursuing' | 'submitted' | 'awarded' | 'lost' | undefined;
}) {
  if (!iso) return null;
  if (status !== 'submitted' && status !== 'awarded' && status !== 'lost') return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.max(0, Math.round((Date.now() - t) / (24 * 60 * 60 * 1000)));
  // Stale (>21d) only meaningful while still 'submitted'. Once awarded/lost
  // the badge is just informational.
  const stale = status === 'submitted' && days > 21;
  const tone = stale
    ? 'border-red-300 bg-red-50 text-red-800'
    : 'border-gray-300 bg-gray-50 text-gray-700';
  const label = days === 0 ? 'today' : `${days}d ago`;
  return (
    <span
      className={`mt-1 mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      Submitted {label}
    </span>
  );
}

function BidStatusPill({ status }: { status: 'pursuing' | 'submitted' | 'awarded' | 'lost' | undefined }) {
  const s = status ?? 'pursuing';
  const tone =
    s === 'awarded'
      ? 'border-green-300 bg-green-50 text-green-800'
      : s === 'lost'
        ? 'border-gray-300 bg-gray-100 text-gray-600'
        : s === 'submitted'
          ? 'border-blue-300 bg-blue-50 text-blue-800'
          : 'border-amber-300 bg-amber-50 text-amber-800';
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <span
      className={`mt-1 mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

function BidDuePill({ iso, locale }: { iso: string | undefined; locale: 'en' | 'es' }) {
  const c = bidDueCountdown(iso, undefined, locale);
  if (c.level === 'none') return null;
  const tone =
    c.level === 'red'
      ? 'border-red-300 bg-red-50 text-red-800'
      : c.level === 'orange'
        ? 'border-orange-300 bg-orange-50 text-orange-800'
        : c.level === 'yellow'
          ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
          : 'border-green-300 bg-green-50 text-green-800';
  return (
    <span
      title={c.longLabel}
      className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      Due · {c.shortLabel}
    </span>
  );
}

export default async function EstimatesPage() {
  requirePermission('estimates:view');
  let estimates: EstimateSummary[] = [];
  let fetchError: string | null = null;
  try {
    estimates = await fetchEstimates();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error';
  }
  estimates = sortByUrgency(estimates);
  const dueCounts = countDueBuckets(estimates);
  const statusCounts: Record<'pursuing' | 'submitted' | 'awarded' | 'lost', number> = {
    pursuing: 0,
    submitted: 0,
    awarded: 0,
    lost: 0,
  };
  for (const e of estimates) {
    const k = (e.bidStatus ?? 'pursuing') as 'pursuing' | 'submitted' | 'awarded' | 'lost';
    statusCounts[k]++;
  }
  const imported = await fetchImported();
  const t = getTranslator();
  const locale = coerceLocale(cookies().get('yge-locale')?.value);

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
          {t('estimates.savedDrafts')} &rarr;
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-yge-blue-500">{t('estimates.title')}</h1>
          <p className="mt-2 text-gray-700">{t('estimates.subtitle')}</p>
          {(dueCounts.overdue > 0 || dueCounts.dueSoon > 0) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {dueCounts.overdue > 0 && (
                <span className="inline-block rounded-full border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-800">
                  {dueCounts.overdue} overdue
                </span>
              )}
              {dueCounts.dueSoon > 0 && (
                <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                  {dueCounts.dueSoon} due in 7 days
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EstimatesShortcutsChip />
          <Link
            href="/plans-to-estimate"
            className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
          >
            + Start new estimate
          </Link>
        </div>
      </div>

      {/* Imported estimates from the YGE Excel master.
       *  These are full Excel estimates with line items grouped by section.
       *  Distinct from the AI-drafted PricedEstimates table below. */}
      {imported.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Imported estimates</h2>
            <p className="text-xs text-gray-500">
              Loaded from the YGE Excel job-cost-system master.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table id="imported-estimates-table" className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th data-sort-key="name" className="select-none px-4 py-2 hover:bg-gray-100">
                    Project
                    <span className="sort-arrow" />
                  </th>
                  <th className="px-4 py-2">Job #</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Lines</th>
                  <th data-sort-key="cents" className="select-none px-4 py-2 hover:bg-gray-100">
                    Bid total
                    <span className="sort-arrow" />
                  </th>
                  <th data-sort-key="updated" className="select-none px-4 py-2 hover:bg-gray-100">
                    Updated
                    <span className="sort-arrow" />
                  </th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {imported.map((e) => (
                  <tr
                    key={e.id}
                    data-search={`${e.projectName} ${e.client ?? ''} ${e.jobNumber}`}
                    data-cents={e.bidPriceCents}
                    data-sort-cents={e.bidPriceCents}
                    data-sort-updated={e.updatedAt}
                    data-sort-name={e.projectName.toLowerCase()}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        <Link
                          href={`/imported-estimates/${e.id}`}
                          className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                        >
                          {e.projectName}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {e.jobNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{e.client ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{e.rateType}</td>
                    <td className="px-4 py-3 text-gray-700">{e.lines.length}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Money cents={e.bidPriceCents} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatWhen(e.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link href={`/imported-estimates/${e.id}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                          Open
                        </Link>
                        {e.jobId && (
                          <Link href={`/jobs/${e.jobId}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                            Job
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* AI-drafted priced estimates section header — only show when
       *  imported estimates are above so the visual separation is clear. */}
      {imported.length > 0 && (
        <h2 className="mt-10 text-lg font-semibold text-gray-900">
          AI-drafted estimates
        </h2>
      )}

      {fetchError && (
        <Alert tone="danger" className="mt-6" title={t('estimates.fetchError.title')}>
          {fetchError}. Make sure the API server is running on port 4000.
        </Alert>
      )}

      {!fetchError && estimates.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {t('estimates.empty.no_estimates')}
        </div>
      )}

      {estimates.length > 0 && (
        <div className="mt-6">
          <EstimatesSearchInput targetId="estimates-table,imported-estimates-table" totalCount={estimates.length + imported.length} />
          <EstimatesSortHeaders targetId="estimates-table" />
          <EstimatesSortHeaders targetId="imported-estimates-table" />
          <div className="flex flex-wrap items-center gap-2">
            <EstimatesStatusFilter targetId="estimates-table" counts={statusCounts} total={estimates.length} />
            <EstimatesDueWeekChip targetId="estimates-table" count={dueCounts.overdue + dueCounts.dueSoon} />
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table id="estimates-table" className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th data-sort-key="name" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('estimates.col.project')}
                  <span className="sort-arrow" />
                </th>
                <th className="hidden px-4 py-2 md:table-cell">{t('estimates.col.type')}</th>
                <th className="hidden px-4 py-2 sm:table-cell">{t('estimates.col.lines')}</th>
                <th className="hidden px-4 py-2 lg:table-cell">{t('estimates.col.subs')}</th>
                <th className="hidden px-4 py-2 lg:table-cell">{t('estimates.col.addenda')}</th>
                <th data-sort-key="cents" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('estimates.col.bidTotal')}
                  <span className="sort-arrow" />
                </th>
                <th data-sort-key="updated" className="hidden select-none px-4 py-2 hover:bg-gray-100 sm:table-cell">
                  {t('estimates.col.updated')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.map((e) => (
                <tr
                  key={e.id}
                  data-search={`${e.projectName} ${e.ownerAgency ?? ''} ${e.projectType.replace(/_/g, ' ')}`}
                  data-cents={e.bidTotalCents}
                  data-sort-cents={e.bidTotalCents}
                  data-sort-updated={e.updatedAt}
                  data-sort-name={e.projectName.toLowerCase()}
                  data-status={e.bidStatus ?? 'pursuing'}
                  data-due={e.bidDueDate ?? ''}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      <Link
                        href={`/estimates/${e.id}`}
                        className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {e.projectName}
                      </Link>
                    </div>
                    {e.ownerAgency && (
                      <div className="text-xs text-gray-500">{e.ownerAgency}</div>
                    )}
                    <BidStatusPill status={e.bidStatus} />
                    <SubmittedAgePill iso={e.bidSubmittedAt} status={e.bidStatus} />
                    <BidDuePill iso={e.bidDueDate} locale={locale} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-600 md:table-cell">
                    {e.projectType.replace(/_/g, ' ')}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">
                    {e.pricedLineCount} of {e.bidItemCount}
                    {e.unpricedLineCount > 0 && (
                      <span className="ml-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">
                        {t('estimates.lines.unpriced', { count: e.unpricedLineCount })}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-700 lg:table-cell">
                    {e.subBidCount && e.subBidCount > 0 ? (
                      <span>
                        {t('estimates.subs.count', { count: e.subBidCount, plural: e.subBidCount === 1 ? '' : 's' })}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t('estimates.subs.none')}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-700 lg:table-cell">
                    {e.addendumCount && e.addendumCount > 0 ? (
                      <span>
                        {e.addendumCount} addend
                        {e.addendumCount === 1 ? 'um' : 'a'}
                        {e.unacknowledgedAddendumCount &&
                        e.unacknowledgedAddendumCount > 0 ? (
                          <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                            {t('estimates.addenda.unacked', { count: e.unacknowledgedAddendumCount })}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t('estimates.addenda.none')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {e.unpricedLineCount > 0 ? (
                      <span className="text-gray-500">
                        <Money cents={e.bidTotalCents} />{' '}
                        <span className="text-[10px] uppercase">{t('estimates.bidTotal.running')}</span>
                      </span>
                    ) : (
                      <Money cents={e.bidTotalCents} />
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-600 sm:table-cell">
                    {formatWhen(e.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/estimates/${e.id}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                        {t('estimates.action.open')}
                      </Link>
                      <Link href={`/estimates/${e.id}/print`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                        {t('estimates.action.print')}
                      </Link>
                      <Link href={`/estimates/${e.id}/transmittal`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                        {t('estimates.action.cover')}
                      </Link>
                      <Link href={`/estimates/${e.id}/envelope`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                        {t('estimates.action.envelope')}
                      </Link>
                      <a
                        href={`${publicApiBaseUrl()}/api/priced-estimates/${e.id}/export.csv`}
                        className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
                      >
                        {t('estimates.action.csv')}
                      </a>
                      <CopyEstimateLink
                        sourceId={e.id}
                        sourceProjectName={e.projectName}
                        sourceJobId={e.jobId}
                        apiBaseUrl={publicApiBaseUrl()}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </main>
    </AppShell>
  );
}
