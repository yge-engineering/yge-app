// 1821: job detail has Back to Jobs link by default.
// 1797: job detail already exposes cost-code variance / overview print / etc.
// 1778: job detail enhancements pending (links to variance, print summary, agency forecast).
// /jobs/[id] — job detail. Shows metadata + every draft and priced estimate
// tied to this job, plus quick links to spin up a new one.
//
// Server component for the read; the inline edit-status control is a small
// client island below.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlankEstimateButton } from '@/components/blank-estimate-button';
import { AuditBinderPanel, Money } from '../../../components';
import { projectTypeIcon } from '../../../lib/project-type-icon';
import { relativeTime } from '../../../lib/relative-time';
import { CopyIdChip } from '../../../components/copy-id-chip';
import { DashboardRefreshButton } from '../../../components/dashboard-refresh-button';
import { PinnedIndicator } from '../../../components/pinned-indicator';
import { CopyMoneyButton } from '../../../components/copy-money-button';
import { getTranslator } from '../../../lib/locale';
import { JobOneDriveLink } from '../../../components/job-onedrive-link';
import { AddToCalendarButton } from '../../../components/add-to-calendar-button';
import {
  contractTypeLabel,
  nextBidAction,
  ROLE_PERMISSIONS,
  statusLabel,
  type Job,
  type PortalUser,
} from '@yge/shared';
import { getCurrentUser } from '../../../lib/auth';
import { JobStatusEditor } from '@/components/job-status-editor';
import { JobInfoEditor } from '@/components/job-info-editor';
import { BidDueBanner } from '@/components/bid-due-banner';
import { JobAgencyCompetitors } from '@/components/job-agency-competitors';
import { JobLinkedBidTabs } from '@/components/job-linked-bid-tabs';
import { ImportedDailyReportsPanel } from '@/components/imported-daily-reports-panel';
import { JobBudgetActualTile } from '@/components/job-budget-actual-tile';
import { QuickLogLineForm } from '@/components/quick-log-line-form';
import { JobProfitabilityTile } from '@/components/job-profitability-tile';
import { ImportEstimateButton } from '@/components/import-estimate-button';
import { ForecastStrip } from '@/components/forecast-strip';
import { fetchNwsForecast } from '@/lib/nws';

interface DraftSummary {
  id: string;
  createdAt: string;
  jobId: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bidItemCount: number;
  modelUsed: string;
  promptVersion: string;
}

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
  subBidCount?: number;
  addendumCount?: number;
  unacknowledgedAddendumCount?: number;
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  notesPreview?: string;
  reviewedLineCount?: number;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { job: Job };
  return json.job;
}

async function fetchDrafts(): Promise<DraftSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/plans-to-estimate/drafts`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { drafts: DraftSummary[] };
  return json.drafts;
}

async function fetchEstimates(): Promise<EstimateSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
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

async function fetchImportedEstimates(): Promise<ImportedEstimateSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/imported-estimates`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { importedEstimates: ImportedEstimateSummary[] };
  return json.importedEstimates;
}

function JobBidStatusPill({
  status,
}: {
  status: 'pursuing' | 'submitted' | 'awarded' | 'lost' | undefined;
}) {
  const v = status ?? 'pursuing';
  const tone =
    v === 'awarded'
      ? 'border-green-300 bg-green-50 text-green-800'
      : v === 'lost'
        ? 'border-gray-300 bg-gray-100 text-gray-600'
        : v === 'submitted'
          ? 'border-blue-300 bg-blue-50 text-blue-800'
          : 'border-amber-300 bg-amber-50 text-amber-800';
  return (
    <span
      className={`ml-2 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {v}
    </span>
  );
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


async function fetchMicrosoftConnected(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/microsoft/status?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { connected?: boolean };
    return Boolean(body.connected);
  } catch {
    return false;
  }
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

  // Foreman scope: 404 if this jobId isn't on the signed-in user's
  // assignedJobIds. Owners / office / PM with jobs:viewAll bypass;
  // crew has neither perm and also 404s.
  const me = getCurrentUser();
  const grants = me ? (ROLE_PERMISSIONS[me.role] ?? []) : [];
  if (!grants.includes('jobs:viewAll')) {
    if (!grants.includes('jobs:viewAssigned') || !me) notFound();
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(me.email)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) notFound();
      const j = (await res.json()) as { user?: PortalUser };
      if (!(j.user?.assignedJobIds ?? []).includes(job.id)) notFound();
    } catch {
      notFound();
    }
  }

  const [allDrafts, allEstimates, allImported] = await Promise.all([
    fetchDrafts(),
    fetchEstimates(),
    fetchImportedEstimates(),
  ]);

  // Sort newest-first so nextBidAction picks the most recent draft / estimate.
  const drafts = allDrafts
    .filter((d) => d.jobId === job.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const estimates = allEstimates
    .filter((e) => e.jobId === job.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const importedEstimates = allImported
    .filter((e) => e.jobId === job.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const action = nextBidAction(job.id, {
    drafts: drafts.map((d) => ({ id: d.id, createdAt: d.createdAt })),
    estimates: estimates.map((e) => ({
      id: e.id,
      bidItemCount: e.bidItemCount,
      pricedLineCount: e.pricedLineCount,
      unpricedLineCount: e.unpricedLineCount,
      unacknowledgedAddendumCount: e.unacknowledgedAddendumCount,
      bidTotalCents: e.bidTotalCents,
    })),
  });
  const t = getTranslator();

  // Hide the financial sub-page links from non-financial roles
  // (foremen, crew). The pages themselves are gated in bundle 922
  // but rendering links to them just to redirect-to-dashboard is
  // confusing.
  const canSeeFinancials = grants.includes('financials:view');

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {t('jobDetail.backLink')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/plans-to-estimate?jobId=${encodeURIComponent(job.id)}`}
            className="rounded-md bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700"
            title="Use AI to draft bid items from a plan PDF or RFP text"
          >
            + AI estimate
          </Link>
          <BlankEstimateButton
            jobId={job.id}
            projectName={job.projectName}
            projectType={job.projectType}
            ownerAgency={job.ownerAgency}
            location={job.location}
            bidDueDate={job.bidDueDate}
            className="rounded-md bg-white border border-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-60"
            label="+ Blank estimate"
          />
          {canSeeFinancials && (
            <Link
              href={`/jobs/${job.id}/cost-breakdown`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              {t('jobDetail.costBreakdown')}
            </Link>
          )}
          {canSeeFinancials && (
            <Link
              href={`/jobs/${job.id}/cost-code-variance`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Cost-code variance
            </Link>
          )}
          <Link
            href={`/jobs/${job.id}/overview-print`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            target="_blank"
            rel="noopener"
          >
            Print job summary
          </Link>
          <Link
            href={`/jobs/${job.id}/binder`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            {t('jobDetail.openBinder')}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-yge-blue-500">
            {job.projectName}
          </h1>
        {/* OneDrive folder pill — creates + opens on first click. */}
        <JobOneDriveLinkSlot job={job} />
        <JobBidDueCalendarSlot job={job} />
        <a href={`/jobs/${params.id}/pwc-100/print`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100">↓ DIR PWC-100</a>
          <p className="mt-1 text-sm uppercase tracking-wide text-gray-500">
            <span className="mr-1">{projectTypeIcon(job.projectType)}</span>
            {contractTypeLabel(job.contractType)} &middot;{' '}
            {job.projectType.replace(/_/g, ' ')}
            {estimates.length > 0 && (
              <>
                {' · '}
                {estimates.length} estimate{estimates.length === 1 ? '' : 's'}
                {' · '}
                <Money cents={estimates.reduce((sum, e) => sum + e.bidTotalCents, 0)} /> total
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <DashboardRefreshButton />
          <PinnedIndicator storageKey="yge.jobs.pinnedIds" eventName="yge:jobs-pinned-changed" id={job.id} />
          <CopyIdChip id={job.id} label="job" />
          <span className="text-xs text-gray-500" title={job.updatedAt}>
            Last edit {relativeTime(job.updatedAt)}
          </span>
          {estimates.length === 1 && estimates[0]!.bidStatus && (
            <JobBidStatusPill status={estimates[0]!.bidStatus} />
          )}
          <JobInfoEditor job={job} />
          <JobStatusEditor jobId={job.id} initialStatus={job.status} />
        </div>
      </div>

      {job.bidDueDate && (
        <div className="mt-6">
          <BidDueBanner bidDueDate={job.bidDueDate} />
        </div>
      )}

      {/* Per-jobsite forecast — shown when the job has lat/lon. */}
      {typeof job.latitude === 'number' && typeof job.longitude === 'number' && (
        <div className="mt-6">
          <ForecastStrip
            forecast={await fetchNwsForecast(job.latitude, job.longitude)}
            locationLabel={job.location ?? job.projectName}
          />
        </div>
      )}

      {/* Quick links — cost variance, etc. Hidden from non-financial roles. */}
      {canSeeFinancials && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/jobs/${job.id}/cost-variance`}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cost code variance →
          </Link>
        </div>
      )}

      {/* Next step card — one click to whatever the estimator should do next */}
      {action.id !== 'no-action' && (
        <div
          className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5 ${
            action.done
              ? 'border-green-300 bg-green-50'
              : 'border-yge-blue-200 bg-yge-blue-50'
          }`}
        >
          <div>
            <div
              className={`text-xs font-semibold uppercase tracking-wide ${
                action.done ? 'text-green-700' : 'text-yge-blue-700'
              }`}
            >
              {t('jobDetail.nextStep')}
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {action.label}
            </div>
            <div className="mt-1 text-sm text-gray-700">{action.detail}</div>
          </div>
          {action.href && (
            <Link
              href={action.href}
              className={`rounded px-4 py-2 text-sm font-semibold text-white ${
                action.done
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-yge-blue-500 hover:bg-yge-blue-700'
              }`}
            >
              {t('jobDetail.doIt')}
            </Link>
          )}
        </div>
      )}

      <dl className="mt-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
        {job.ownerAgency && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {t('jobDetail.field.ownerAgency')}
            </dt>
            <dd className="mt-1 text-gray-900">{job.ownerAgency}</dd>
          </div>
        )}
        {job.location && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">{t('jobDetail.field.location')}</dt>
            <dd className="mt-1 text-gray-900"><a href={`https://maps.apple.com/?q=${encodeURIComponent(job.location ?? '')}`} target="_blank" rel="noopener noreferrer" className="text-yge-blue-500 hover:underline">{job.location}</a></dd>
          </div>
        )}
        {job.bidDueDate && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {t('jobDetail.field.bidDue')}
            </dt>
            <dd className="mt-1 text-gray-900">{job.bidDueDate}</dd>
          </div>
        )}
        {job.engineersEstimateCents !== undefined && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {t('jobDetail.field.engineersEstimate')}
            </dt>
            <dd className="mt-1 text-gray-900">
              <Money cents={job.engineersEstimateCents} />
            </dd>
          </div>
        )}
        {job.pursuitOwner && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {t('jobDetail.field.pursuitOwner')}
            </dt>
            <dd className="mt-1 text-gray-900">{job.pursuitOwner}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">{t('jobDetail.field.status')}</dt>
          <dd className="mt-1 text-gray-900">{statusLabel(job.status)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">{t('jobDetail.field.created')}</dt>
          <dd className="mt-1 text-gray-900">{formatDate(job.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">
            {t('jobDetail.field.lastUpdated')}
          </dt>
          <dd className="mt-1 text-gray-900">{formatWhen(job.updatedAt)}</dd>
        </div>
      </dl>

      {job.notes && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-yellow-50 p-4 text-sm text-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {t('jobDetail.h.pursuitNotes')}
          </div>
          <p className="mt-2 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {job.ownerAgency && (
        <JobAgencyCompetitors apiBaseUrl={apiBaseUrl()} ownerAgency={job.ownerAgency} />
      )}

      <JobProfitabilityTile jobId={job.id} />

      <JobLinkedBidTabs apiBaseUrl={apiBaseUrl()} jobId={job.id} />

      {/* Plans-to-Estimate drafts for this job */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('jobDetail.h.drafts')}
          </h2>
          <div className="flex items-center gap-2">
            <ImportEstimateButton
              presetJobId={job.id}
              label="⬆ Import from Excel"
            />
            <Link
              href={`/plans-to-estimate?jobId=${encodeURIComponent(job.id)}`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              {t('jobDetail.newDraft')}
            </Link>
          </div>
        </div>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            {t('jobDetail.drafts.empty')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">
                    <Link
                      href={`/drafts/${d.id}`}
                      className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                    >
                      {d.projectName}
                    </Link>
                    <span className="ml-2 inline-block rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                      🤖 AI
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <span title={d.createdAt}>{t('jobDetail.drafts.itemCount', { count: d.bidItemCount, when: relativeTime(d.createdAt) })}</span>
                  </div>
                </div>
                <Link
                  href={`/drafts/${d.id}`}
                  className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
                >
                  {t('jobDetail.action.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Priced estimates for this job */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('jobDetail.h.estimates')}
            {(() => {
              const active = estimates.filter(
                (e) => e.bidStatus !== 'awarded' && e.bidStatus !== 'lost',
              );
              if (active.length === 0) return null;
              const ready = active.filter(
                (e) =>
                  (e.unpricedLineCount ?? 0) === 0 &&
                  (e.unacknowledgedAddendumCount ?? 0) === 0,
              ).length;
              const won = estimates.filter((e) => e.bidStatus === 'awarded').length;
              const lost = estimates.filter((e) => e.bidStatus === 'lost').length;
              const bidTotalsByStatus = estimates.reduce(
                (acc, e) => {
                  const k = (e.bidStatus ?? 'pursuing') as 'pursuing' | 'submitted' | 'awarded' | 'lost';
                  acc[k] = (acc[k] ?? 0) + e.bidTotalCents;
                  return acc;
                },
                {} as Record<string, number>,
              );
              return (
                <>
                  <span className="ml-3 inline-block rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-normal text-gray-600">
                    {ready} of {active.length} active ready
                  </span>
                  {won > 0 && (
                    <span className="ml-1 inline-block rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                      {won} won
                    </span>
                  )}
                  {lost > 0 && (
                    <span className="ml-1 inline-block rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {lost} lost
                    </span>
                  )}
                </>
              );
            })()}
          </h2>
          {estimates.length > 0 && (
            <Link
              href={`/plans-to-estimate?jobId=${encodeURIComponent(job.id)}`}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              + Add another estimate
            </Link>
          )}
        </div>
        {estimates.length > 0 && (() => {
          const totalsByStatus: Record<string, number> = {};
          for (const e of estimates) {
            const k = e.bidStatus ?? 'pursuing';
            totalsByStatus[k] = (totalsByStatus[k] ?? 0) + e.bidTotalCents;
          }
          return (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(['pursuing', 'submitted', 'awarded', 'lost'] as const).map((k) => {
                const cents = totalsByStatus[k] ?? 0;
                if (cents === 0) return null;
                const tone =
                  k === 'pursuing'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : k === 'submitted'
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : k === 'awarded'
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-gray-100 text-gray-700';
                return (
                  <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${tone}`}>
                    <span className="uppercase tracking-wide opacity-70">{k}</span>
                    <span className="font-mono font-semibold"><Money cents={cents} /></span>
                  </span>
                );
              })}
            </div>
          );
        })()}
        {estimates.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-700">{t('jobDetail.estimates.empty')}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={`/plans-to-estimate?jobId=${encodeURIComponent(job.id)}`}
                className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
              >
                + Start AI draft
              </Link>
              <BlankEstimateButton
                jobId={job.id}
                projectName={job.projectName}
                projectType={job.projectType}
                ownerAgency={job.ownerAgency}
                location={job.location}
                bidDueDate={job.bidDueDate}
                className="rounded-md border border-yge-blue-500 bg-white px-4 py-2 text-sm font-semibold text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-60"
                label="+ Blank estimate"
              />
            </div>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {estimates.map((e) => {
              // Split-and-fill: keep the inline <Money/> in the localized
              // 'priced of total · dollars · when' summary template.
              const summaryTpl = t('jobDetail.estimates.summary', {
                priced: e.pricedLineCount,
                total: e.bidItemCount,
                dollars: '__DOLLARS__',
                when: `__WHEN__`,
              });
              const whenLabel = relativeTime(e.updatedAt);
              const [pre, post] = summaryTpl.split('__DOLLARS__');
              const [postBefore, postAfter] = (post ?? '').split('__WHEN__');
              const tintClass =
                e.bidStatus === 'awarded'
                  ? 'bg-green-50/50'
                  : e.bidStatus === 'lost'
                    ? 'bg-gray-50'
                    : '';
              return (
                <li key={e.id} className={`flex items-center justify-between px-4 py-3 ${tintClass}`}>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      <PinnedIndicator storageKey="yge.estimates.pinnedIds" eventName="yge:pinned-changed" id={e.id} />
                      {(() => {
                        if (e.bidStatus === 'awarded' || e.bidStatus === 'lost') return null;
                        const issues =
                          (e.unpricedLineCount ?? 0) +
                          (e.unacknowledgedAddendumCount ?? 0);
                        if (issues === 0) {
                          return (
                            <span className="mr-2 text-xs text-green-700" title="Ready to submit">
                              ✓
                            </span>
                          );
                        }
                        return (
                          <span
                            className="mr-2 text-xs font-semibold text-red-700"
                            title={`${e.unpricedLineCount ?? 0} unpriced · ${e.unacknowledgedAddendumCount ?? 0} un-acked`}
                          >
                            ✗
                          </span>
                        );
                      })()}
                      {e.projectName}
                      <JobBidStatusPill status={e.bidStatus} />
                    </div>
                    <div className="text-xs text-gray-500">
                      {pre}<CopyMoneyButton cents={e.bidTotalCents}><Money cents={e.bidTotalCents} /></CopyMoneyButton>{postBefore}
                      <span title={e.updatedAt}>{whenLabel}</span>
                      {postAfter}
                    </div>
                    {e.notesPreview && (
                      <div className="mt-1 text-[11px] italic text-gray-500">
                        ✏ {e.notesPreview}
                      </div>
                    )}
                    {typeof e.reviewedLineCount === 'number' && e.bidItemCount > 0 && e.reviewedLineCount < e.bidItemCount && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        {e.reviewedLineCount}/{e.bidItemCount} lines reviewed
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    <Link href={`/estimates/${e.id}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.open')}
                    </Link>
                    <Link href={`/estimates/${e.id}/print`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.print')}
                    </Link>
                    <Link href={`/estimates/${e.id}/transmittal`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.cover')}
                    </Link>
                    <Link href={`/estimates/${e.id}/envelope`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.envelope')}
                    </Link>
                    <Link href={`/estimates/${e.id}/sub-list`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.subs')}
                    </Link>
                    <Link href={`/estimates/${e.id}/addenda`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                      {t('jobDetail.action.addenda')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Imported estimates (from Excel) for this job */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Imported estimates</h2>
          <p className="text-xs text-gray-500">
            Loaded from the YGE Excel job-cost-system file.
          </p>
        </div>
        {importedEstimates.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No imported estimates linked to this job.{' '}
            <Link
              href="/imported-estimates"
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Browse all imported estimates →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {importedEstimates.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    <Link
                      href={`/imported-estimates/${e.id}`}
                      className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                    >
                      {e.projectName}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-500">
                    Job {e.jobNumber} · {e.rateType} · {e.lines.length} line
                    {e.lines.length === 1 ? '' : 's'} · Direct{' '}
                    <Money cents={e.directCostCents} /> · O&amp;P{' '}
                    <Money cents={e.oppMarkupCents} /> · Bid{' '}
                    <Money cents={e.bidPriceCents} />
                  </div>
                </div>
                <Link
                  href={`/imported-estimates/${e.id}`}
                  className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">
          Budget vs actual
        </h2>
        <JobBudgetActualTile jobId={job.id} />
        <div className="mt-4">
          <QuickLogLineForm jobId={job.id} />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Daily reports (imported)
          </h2>
          <p className="text-xs text-gray-500">
            Loaded from the YGE Excel job-cost-system file.
          </p>
        </div>
        <ImportedDailyReportsPanel jobId={job.id} />
      </section>

      <section className="mt-10 print:hidden">
        <h2 className="text-xl font-semibold text-gray-900">
          Compliance forms
        </h2>
        <p className="text-xs text-gray-500">
          Print-to-PDF templates for the CA prevailing-wage docs Brook
          files per job. Hand-fill the trade-specific blanks before
          mailing.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/jobs/${job.id}/das-140`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            🖨 DAS-140 (Notice of contract award)
          </a>
          <a
            href={`/jobs/${job.id}/bid-invite`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            🖨 Bid invitation letter
          </a>
          <a
            href={`/certified-payrolls/new?jobId=${job.id}`}
            className="rounded border border-yge-blue-500 bg-yge-blue-50 px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100"
          >
            + Start this week's CPR
          </a>
          <a
            href={`/jobs/${job.id}/das-141`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            🖨 DAS-141 (Request for dispatch)
          </a>
          <a
            href={`/jobs/${job.id}/das-142`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            🖨 DAS-142 (Training fund contributions)
          </a>
        </div>
      </section>

      <div className="print:hidden">
        <AuditBinderPanel entityType="Job" entityId={job.id} />
      </div>
    </main>
  );
}

async function JobOneDriveLinkSlot({ job }: { job: { jobNumber?: string; name?: string; projectName?: string } }) {
  const { getCurrentUser } = await import('../../../lib/auth');
  const user = getCurrentUser();
  if (!user?.email) return null;
  const connected = await fetchMicrosoftConnected(user.email);
  if (!connected) return null;
  const jobNumber = job.jobNumber ?? '';
  const projectName = job.projectName ?? job.name ?? 'Untitled job';
  if (!jobNumber) return null;
  return (
    <JobOneDriveLink
      email={user.email}
      jobNumber={jobNumber}
      projectName={projectName}
      microsoftConnected={true}
    />
  );
}
async function JobBidDueCalendarSlot({ job }: { job: { bidDueDate?: string; projectName?: string } }) {
  if (!job.bidDueDate) return null;
  const { getCurrentUser } = await import('../../../lib/auth');
  const user = getCurrentUser();
  if (!user?.email) return null;
  const connected = await fetchMicrosoftConnected(user.email);
  if (!connected) return null;
  // bidDueDate is yyyy-mm-dd; create an all-day event on that date.
  const startDateTime = job.bidDueDate + 'T09:00:00';
  const endDateTime = job.bidDueDate + 'T10:00:00';
  return (
    <AddToCalendarButton
      email={user.email}
      subject={`Bid due: ${job.projectName ?? 'YGE bid'}`}
      startDateTime={startDateTime}
      endDateTime={endDateTime}
      label="Add bid-due to my Outlook"
    />
  );
}

