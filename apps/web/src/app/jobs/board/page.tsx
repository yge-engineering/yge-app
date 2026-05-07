// /jobs/board — pursuit-pipeline Kanban view.
//
// Plain English: each column is a JobStatus bucket. Cards link to
// the job detail. Counts + total engineer's-estimate per column
// surface the pipeline weight at a glance.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
  StatusPill,
} from '../../../components';
import { getTranslator } from '../../../lib/locale';
import {
  bidDueCountdown,
  type Job,
  type JobStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch {
    return [];
  }
}

interface Column {
  status: JobStatus | 'CLOSED';
  label: string;
  description: string;
  jobs: Job[];
  totalEngineersEstimateCents: number;
  /** "active" columns get a stronger style than the inactive trio. */
  active: boolean;
}

const COLUMN_DEFS: Array<{
  status: JobStatus | 'CLOSED';
  label: string;
  description: string;
  active: boolean;
}> = [
  { status: 'PROSPECT',       label: 'Prospect',       description: 'on radar, not yet decided', active: true  },
  { status: 'PURSUING',       label: 'Pursuing',       description: 'estimating now',             active: true  },
  { status: 'BID_SUBMITTED',  label: 'Bid submitted',  description: 'awaiting agency open',       active: true  },
  { status: 'AWARDED',        label: 'Awarded',        description: 'won — gear up to start',     active: true  },
  { status: 'CLOSED',         label: 'Lost / no-bid / archived', description: 'historical',         active: false },
];

function bucketize(jobs: Job[]): Column[] {
  const out: Column[] = COLUMN_DEFS.map((c) => ({
    ...c,
    jobs: [],
    totalEngineersEstimateCents: 0,
  }));
  for (const j of jobs) {
    let target: Column | undefined;
    if (j.status === 'LOST' || j.status === 'NO_BID' || j.status === 'ARCHIVED') {
      target = out.find((c) => c.status === 'CLOSED');
    } else {
      target = out.find((c) => c.status === j.status);
    }
    if (!target) continue;
    target.jobs.push(j);
    target.totalEngineersEstimateCents += j.engineersEstimateCents ?? 0;
  }
  // Sort each column: nearest bid-due first, then newest first.
  for (const c of out) {
    c.jobs.sort((a, b) => {
      if (a.bidDueDate && b.bidDueDate)
        return a.bidDueDate.localeCompare(b.bidDueDate);
      if (a.bidDueDate) return -1;
      if (b.bidDueDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
  return out;
}

export default async function JobsBoardPage() {
  const jobs = await fetchJobs();
  const columns = bucketize(jobs);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px]">
        <PageHeader
          title="Pursuit pipeline"
          subtitle="Jobs grouped by status. Each card links to the job detail. Sorted by nearest bid-due first."
          actions={
            <Link
              href="/jobs"
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              List view →
            </Link>
          }
        />

        <div className="grid gap-3 lg:grid-cols-5">
          {columns.map((col) => (
            <section
              key={col.status}
              className={`rounded-md border ${
                col.active
                  ? 'border-yge-blue-200 bg-yge-blue-50'
                  : 'border-gray-200 bg-gray-50'
              } p-3`}
            >
              <header className="mb-2">
                <h2
                  className={`text-sm font-semibold ${
                    col.active ? 'text-yge-blue-900' : 'text-gray-700'
                  }`}
                >
                  {col.label}
                </h2>
                <p className="text-xs text-gray-600">
                  {col.jobs.length} job{col.jobs.length === 1 ? '' : 's'}
                  {col.totalEngineersEstimateCents > 0 ? (
                    <>
                      {' · '}
                      <Money cents={col.totalEngineersEstimateCents} />
                    </>
                  ) : null}
                </p>
                <p className="text-[11px] text-gray-500">{col.description}</p>
              </header>
              <ul className="space-y-2">
                {col.jobs.map((j) => {
                  const bidDue = j.bidDueDate
                    ? bidDueCountdown(j.bidDueDate, new Date())
                    : null;
                  const dueTone =
                    bidDue && bidDue.level === 'red' && col.status === 'PURSUING'
                      ? 'border-red-300 bg-red-50'
                      : bidDue &&
                          (bidDue.level === 'orange' || bidDue.level === 'yellow') &&
                          col.status === 'PURSUING'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-white bg-white';
                  return (
                    <li
                      key={j.id}
                      className={`rounded border ${dueTone} p-2 text-xs shadow-sm`}
                    >
                      <Link
                        href={`/jobs/${j.id}`}
                        className="font-semibold text-gray-900 hover:text-yge-blue-700"
                      >
                        {j.projectName}
                      </Link>
                      <div className="mt-0.5 text-gray-600">
                        {j.ownerAgency ? <>{j.ownerAgency} · </> : null}
                        {j.location ?? ''}
                      </div>
                      {bidDue ? (
                        <div className="mt-1 text-[11px]">
                          Bid due:{' '}
                          <span
                            className={
                              bidDue.level === 'red'
                                ? 'font-semibold text-red-700'
                                : bidDue.level === 'orange' || bidDue.level === 'yellow'
                                  ? 'font-semibold text-amber-700'
                                  : 'text-gray-700'
                            }
                          >
                            {j.bidDueDate}
                          </span>
                        </div>
                      ) : null}
                      {j.engineersEstimateCents != null ? (
                        <div className="mt-1 text-[11px] font-mono text-gray-700">
                          <Money cents={j.engineersEstimateCents} /> EE
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {col.jobs.length === 0 ? (
                  <li className="rounded border border-dashed border-gray-300 bg-white p-2 text-center text-[11px] text-gray-400">
                    Empty.
                  </li>
                ) : null}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          {t('jobsBoard.disclaimer', { default: '' }) ||
            "Drag-and-drop status changes ship next; for now click a card and update status from the job detail."}
        </p>
      </main>
    </AppShell>
  );
}
