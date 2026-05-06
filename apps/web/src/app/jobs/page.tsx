// /jobs — list of every job in the pursuit pipeline.
//
// Server component: fetches the full list at request time. The Job model is
// small (just metadata), so a single GET /api/jobs round-trip is plenty.

import Link from 'next/link';

import { Alert, AppShell, Money } from '../../components';
import { JobsSearchInput } from '../../components/jobs-search-input';
import { JobsCreatedFilter } from '../../components/jobs-created-filter';
import { JobsResetFilters } from '../../components/jobs-reset-filters';
import { CopyMoneyButton } from '../../components/copy-money-button';
import { EstimatesSortHeaders } from '../../components/estimates-sort-headers';
import { getLocale, getTranslator } from '../../lib/locale';
import { getCurrentUser } from '../../lib/auth';
import {
  bidDueCountdown,
  contractTypeLabel,
  ROLE_PERMISSIONS,
  statusLabel,
  type Job,
  type JobStatus,
  type PortalUser,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface EstimateLite {
  jobId: string;
  bidDueDate?: string;
}

async function fetchEstimateLites(): Promise<EstimateLite[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { estimates: EstimateLite[] };
    return json.estimates ?? [];
  } catch {
    return [];
  }
}

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { jobs: Job[] };
  return json.jobs;
}

/** Foreman scope: load the signed-in user's PortalUser record so we
 *  can read their assignedJobIds[]. Owners / office / PM see all
 *  jobs; foremen see only their assigned ones; crew sees none. */
async function fetchMyPortalUser(email: string): Promise<PortalUser | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { user?: PortalUser };
    return json.user ?? null;
  } catch {
    return null;
  }
}

function JobBidDuePill({ iso }: { iso: string | undefined }) {
  const c = bidDueCountdown(iso, undefined, 'en');
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
      className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {c.shortLabel}
    </span>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Color the status pill so the dashboard view tells you at a glance whether
// a job is still in active pursuit or already closed out.
function statusPillClass(status: JobStatus): string {
  switch (status) {
    case 'PROSPECT':
      return 'bg-gray-100 text-gray-800';
    case 'PURSUING':
      return 'bg-yellow-100 text-yellow-800';
    case 'BID_SUBMITTED':
      return 'bg-blue-100 text-blue-800';
    case 'AWARDED':
      return 'bg-green-100 text-green-800';
    case 'LOST':
      return 'bg-red-100 text-red-800';
    case 'NO_BID':
      return 'bg-gray-200 text-gray-700';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-500';
  }
}

interface PageProps {
  searchParams?: { status?: string };
}

const FILTER_PRESETS: { labelKey: string; value: string; matches: (s: JobStatus) => boolean }[] = [
  { labelKey: 'jobs.filter.all', value: 'all', matches: () => true },
  { labelKey: 'jobs.filter.active', value: 'active', matches: (s) => s === 'PURSUING' || s === 'BID_SUBMITTED' || s === 'AWARDED' },
  { labelKey: 'jobs.filter.pursuing', value: 'PURSUING', matches: (s) => s === 'PURSUING' },
  { labelKey: 'jobs.filter.bidSubmitted', value: 'BID_SUBMITTED', matches: (s) => s === 'BID_SUBMITTED' },
  { labelKey: 'jobs.filter.awarded', value: 'AWARDED', matches: (s) => s === 'AWARDED' },
  { labelKey: 'jobs.filter.lostNoBid', value: 'lost', matches: (s) => s === 'LOST' || s === 'NO_BID' },
  { labelKey: 'jobs.filter.archived', value: 'ARCHIVED', matches: (s) => s === 'ARCHIVED' },
];

function sortJobsByUrgency(rows: Job[]): Job[] {
  const now = Date.now();
  return [...rows].sort((a, b) => {
    const ka = jobUrgencyKey(a.bidDueDate, now);
    const kb = jobUrgencyKey(b.bidDueDate, now);
    if (ka !== kb) return ka - kb;
    const ua = new Date(a.updatedAt).getTime();
    const ub = new Date(b.updatedAt).getTime();
    return ub - ua;
  });
}

function jobUrgencyKey(iso: string | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return t - now;
}

export default async function JobsPage({ searchParams }: PageProps) {
  const user = getCurrentUser();
  let jobs: Job[] = [];
  let estimateLites: EstimateLite[] = [];
  let fetchError: string | null = null;
  try {
    [jobs, estimateLites] = await Promise.all([fetchJobs(), fetchEstimateLites()]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error';
  }

  // Foreman scope: filter the list to assignedJobIds. Owners / office /
  // PM with jobs:viewAll see everything. Crew with neither see nothing.
  const grants = user ? (ROLE_PERMISSIONS[user.role] ?? []) : [];
  const canSeeAll = grants.includes('jobs:viewAll');
  const canSeeAssigned = grants.includes('jobs:viewAssigned');
  if (!canSeeAll) {
    if (canSeeAssigned && user) {
      const me = await fetchMyPortalUser(user.email);
      const allowed = new Set(me?.assignedJobIds ?? []);
      jobs = jobs.filter((j) => allowed.has(j.id));
    } else {
      jobs = [];
    }
  }

  const filterValue = searchParams?.status ?? 'active';
  const preset = FILTER_PRESETS.find((p) => p.value === filterValue) ?? FILTER_PRESETS[1];
  // Sort within the preset by bid-due urgency so the most-pressing rows
  // float to the top regardless of which preset is selected.
  jobs = sortJobsByUrgency(jobs);
  const filteredJobs = preset ? jobs.filter((j) => preset.matches(j.status)) : jobs;
  const t = getTranslator();
  const jobStatusCounts: Record<string, number> = {};
  for (const j of filteredJobs) {
    jobStatusCounts[j.status] = (jobStatusCounts[j.status] ?? 0) + 1;
  }
  const estimateStatsByJob: Record<string, { count: number; dueSoon: number }> = {};
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  for (const e of estimateLites) {
    const stat = estimateStatsByJob[e.jobId] ?? { count: 0, dueSoon: 0 };
    stat.count++;
    if (e.bidDueDate) {
      const t2 = new Date(e.bidDueDate).getTime();
      if (!Number.isNaN(t2) && t2 - nowMs <= sevenDaysMs) stat.dueSoon++;
    }
    estimateStatsByJob[e.jobId] = stat;
  }
  const locale = getLocale();
  const presetLabel = preset ? t(preset.labelKey) : '';

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/jobs/new"
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
        >
          {t('jobs.newJob')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('jobs.title')}</h1>
      <p className="mt-2 text-gray-700">
        {filteredJobs.length === 0 ? (
          t('jobs.subtitle')
        ) : (
          <>
            <span className="font-semibold text-gray-900">{filteredJobs.length}</span>
            {' '}job{filteredJobs.length === 1 ? '' : 's'}
            {(['PURSUING', 'BID_SUBMITTED', 'AWARDED', 'LOST'] as const).map((k) =>
              (jobStatusCounts[k] ?? 0) > 0 ? (
                <span key={k}>
                  {' '}· {jobStatusCounts[k]} {k.replace(/_/g, ' ').toLowerCase()}
                </span>
              ) : null,
            )}
          </>
        )}
      </p>

      {/* Filter pills */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTER_PRESETS.map((p) => {
          const active = p.value === filterValue;
          return (
            <Link
              key={p.value}
              href={p.value === 'all' ? '/jobs' : `/jobs?status=${p.value}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              {t(p.labelKey)}
            </Link>
          );
        })}
      </div>

      {fetchError && (
        <Alert tone="danger" className="mt-6" title={t('jobs.fetchError.title')}>
          {fetchError}. Make sure the API server is running on port 4000.
        </Alert>
      )}

      {!fetchError && jobs.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {!canSeeAll && canSeeAssigned ? (
            <span>
              No jobs assigned to you yet. Ryan or the office sets these on{' '}
              <code className="rounded bg-gray-200 px-1 font-mono text-xs">
                /admin/portal-users
              </code>{' '}
              — ask one of them to assign you to a job.
            </span>
          ) : (
            <>
              {t('jobs.empty')}{' '}
              <Link
                href="/jobs/new"
                className="text-yge-blue-500 hover:underline"
              >
                {t('jobs.createFirst')} &rarr;
              </Link>
            </>
          )}
        </div>
      )}

      {!fetchError && jobs.length > 0 && filteredJobs.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p>{t('jobs.noneMatch', { preset: presetLabel })}</p>
          <Link
            href="/jobs?status=all"
            className="mt-2 inline-block rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            {t('jobs.showAll')} &rarr;
          </Link>
        </div>
      )}

      {filteredJobs.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <JobsSearchInput targetId="jobs-table" totalCount={filteredJobs.length} />
            <JobsCreatedFilter targetId="jobs-table" />
            <JobsResetFilters />
          </div>
          <EstimatesSortHeaders targetId="jobs-table" />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table id="jobs-table" className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th data-sort-key="name" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('jobs.col.project')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2">{t('jobs.col.status')}</th>
                <th className="px-4 py-2">{t('jobs.col.type')}</th>
                <th className="px-4 py-2">{t('jobs.col.contract')}</th>
                <th data-sort-key="due" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('jobs.col.due')}
                  <span className="sort-arrow" />
                </th>
                <th data-sort-key="cents" className="select-none px-4 py-2 text-right hover:bg-gray-100">
                  {t('jobs.col.engineerEstimate')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.map((j) => (
                <tr
                  key={j.id}
                  data-search={`${j.projectName} ${j.ownerAgency ?? ''} ${j.location ?? ''}`}
                  data-created={j.createdAt}
                  data-sort-name={j.projectName.toLowerCase()}
                  data-sort-due={j.bidDueDate ?? ''}
                  data-sort-cents={j.engineersEstimateCents ?? 0}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {j.projectName}
                      </Link>
                    </div>
                    {j.ownerAgency && (
                      <div className="text-xs text-gray-500">{j.ownerAgency}</div>
                    )}
                    {j.location && (
                      <div className="text-xs text-gray-500">{j.location}</div>
                    )}
                    {j.notes && (
                      <div className="mt-1 truncate text-[11px] italic text-gray-500" title={j.notes}>
                        ✏ {j.notes.length > 120 ? `${j.notes.slice(0, 120).trimEnd()}…` : j.notes}
                      </div>
                    )}
                    {estimateStatsByJob[j.id] && estimateStatsByJob[j.id]!.count > 0 && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        {estimateStatsByJob[j.id]!.count} estimate
                        {estimateStatsByJob[j.id]!.count === 1 ? '' : 's'}
                        {estimateStatsByJob[j.id]!.dueSoon > 0 ? (
                          <span className="ml-1 inline-block rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-amber-800">
                            {estimateStatsByJob[j.id]!.dueSoon} due ≤ 7d
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPillClass(
                        j.status,
                      )}`}
                    >
                      {statusLabel(j.status, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.projectType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {contractTypeLabel(j.contractType, locale)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.bidDueDate ? (
                      <div className="flex flex-col gap-1">
                        <span>{formatWhen(j.bidDueDate)}</span>
                        <JobBidDuePill iso={j.bidDueDate} />
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-gray-700">
                    {j.engineersEstimateCents !== undefined ? (
                      <CopyMoneyButton cents={j.engineersEstimateCents}>
                        <Money cents={j.engineersEstimateCents} />
                      </CopyMoneyButton>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/jobs/${j.id}`}
                      className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
                    >
                      {t('jobs.open')}
                    </Link>
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
