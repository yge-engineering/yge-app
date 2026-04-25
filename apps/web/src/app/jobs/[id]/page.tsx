// /jobs/[id] — job detail. Shows metadata + every draft and priced estimate
// tied to this job, plus quick links to spin up a new one.
//
// Server component for the read; the inline edit-status control is a small
// client island below.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  contractTypeLabel,
  formatUSD,
  nextBidAction,
  statusLabel,
  type Job,
} from '@yge/shared';
import { JobStatusEditor } from '@/components/job-status-editor';
import { BidDueBanner } from '@/components/bid-due-banner';

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

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

  const [allDrafts, allEstimates] = await Promise.all([
    fetchDrafts(),
    fetchEstimates(),
  ]);

  // Sort newest-first so nextBidAction picks the most recent draft / estimate.
  const drafts = allDrafts
    .filter((d) => d.jobId === job.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const estimates = allEstimates
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

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/jobs" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Jobs
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-yge-blue-500">
            {job.projectName}
          </h1>
          <p className="mt-1 text-sm uppercase tracking-wide text-gray-500">
            {contractTypeLabel(job.contractType)} &middot;{' '}
            {job.projectType.replace(/_/g, ' ')}
          </p>
        </div>
        <JobStatusEditor jobId={job.id} initialStatus={job.status} />
      </div>

      {job.bidDueDate && (
        <div className="mt-6">
          <BidDueBanner bidDueDate={job.bidDueDate} />
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
              Next step
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
              Do it &rarr;
            </Link>
          )}
        </div>
      )}

      <dl className="mt-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
        {job.ownerAgency && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Owner / agency
            </dt>
            <dd className="mt-1 text-gray-900">{job.ownerAgency}</dd>
          </div>
        )}
        {job.location && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Location</dt>
            <dd className="mt-1 text-gray-900">{job.location}</dd>
          </div>
        )}
        {job.bidDueDate && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Bid due
            </dt>
            <dd className="mt-1 text-gray-900">{job.bidDueDate}</dd>
          </div>
        )}
        {job.engineersEstimateCents !== undefined && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Engineer&rsquo;s estimate
            </dt>
            <dd className="mt-1 text-gray-900">
              {formatUSD(job.engineersEstimateCents)}
            </dd>
          </div>
        )}
        {job.pursuitOwner && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Pursuit owner
            </dt>
            <dd className="mt-1 text-gray-900">{job.pursuitOwner}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
          <dd className="mt-1 text-gray-900">{statusLabel(job.status)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Created</dt>
          <dd className="mt-1 text-gray-900">{formatDate(job.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">
            Last updated
          </dt>
          <dd className="mt-1 text-gray-900">{formatWhen(job.updatedAt)}</dd>
        </div>
      </dl>

      {job.notes && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-yellow-50 p-4 text-sm text-gray-800">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Pursuit notes
          </div>
          <p className="mt-2 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Plans-to-Estimate drafts for this job */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Plans-to-Estimate drafts
          </h2>
          <Link
            href={`/plans-to-estimate?jobId=${encodeURIComponent(job.id)}`}
            className="text-sm text-yge-blue-500 hover:underline"
          >
            + New draft
          </Link>
        </div>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No drafts yet for this job.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {d.projectName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {d.bidItemCount} items &middot; {formatWhen(d.createdAt)}
                  </div>
                </div>
                <Link
                  href={`/drafts/${d.id}`}
                  className="text-sm text-yge-blue-500 hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Priced estimates for this job */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Priced estimates</h2>
        {estimates.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No priced estimates yet for this job. Convert a draft above to start one.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {estimates.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {e.projectName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {e.pricedLineCount} of {e.bidItemCount} priced &middot;{' '}
                    {formatUSD(e.bidTotalCents)} bid total &middot;{' '}
                    {formatWhen(e.updatedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Link
                    href={`/estimates/${e.id}`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/estimates/${e.id}/print`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    Print
                  </Link>
                  <Link
                    href={`/estimates/${e.id}/transmittal`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    Cover
                  </Link>
                  <Link
                    href={`/estimates/${e.id}/envelope`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    Envelope
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
