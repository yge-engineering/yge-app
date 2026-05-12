import * as React from 'react';
// Dashboard tile — which prevailing-wage jobs need a CPR filed.
//
// Logic: for each AWARDED / ACTIVE job, find the most recent CPR
// `weekEnding`. If null OR if more than 7 days have passed since
// that week, surface the job as "due this week."

import Link from 'next/link';
import type {
  CertifiedPayroll,
  Job,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

interface DueRow {
  jobId: string;
  projectName: string;
  lastWeekEnding: string | null;
  daysSince: number;
}

async function CprDueTileInner() {
  const [jobs, cprs] = await Promise.all([
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<CertifiedPayroll>('/api/certified-payrolls', 'cprs'),
  ]);

  // Active prevailing-wage jobs only. PURSUING isn't filed yet,
  // CLOSED is final. Keep it tight.
  const active = jobs.filter(
    (j) =>
      j.status === 'AWARDED' ||
      j.status === 'BID_SUBMITTED' ||
      j.status === 'PURSUING',
  );
  if (active.length === 0) return null;

  const cprsByJob = new Map<string, CertifiedPayroll[]>();
  for (const c of cprs) {
    const list = cprsByJob.get(c.jobId) ?? [];
    list.push(c);
    cprsByJob.set(c.jobId, list);
  }
  for (const list of cprsByJob.values()) {
    list.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
  }

  const now = new Date();
  const due: DueRow[] = [];
  for (const j of active) {
    const list = cprsByJob.get(j.id) ?? [];
    const last = list[0];
    if (!last) {
      due.push({
        jobId: j.id,
        projectName: j.projectName,
        lastWeekEnding: null,
        daysSince: Number.POSITIVE_INFINITY,
      });
      continue;
    }
    const lastMs = Date.parse(last.weekEnding);
    const days = Number.isFinite(lastMs)
      ? Math.floor((now.getTime() - lastMs) / (24 * 60 * 60 * 1000))
      : Number.POSITIVE_INFINITY;
    if (days > 7) {
      due.push({
        jobId: j.id,
        projectName: j.projectName,
        lastWeekEnding: last.weekEnding,
        daysSince: days,
      });
    }
  }
  due.sort((a, b) => b.daysSince - a.daysSince);

  if (due.length === 0) {
    return (
      <section className="mb-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
        ✓ All active jobs have a current-week CPR on file.
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            ⚠ CPRs due ({due.length})
          </h2>
          <p className="text-xs text-amber-800">
            Active prevailing-wage jobs missing a CPR for the most
            recent week. File via{' '}
            <Link
              href="/certified-payrolls"
              className="font-semibold underline"
            >
              /certified-payrolls
            </Link>
            .
          </p>
        </div>
      </header>
      <ul className="mt-3 divide-y divide-amber-200 rounded border border-amber-200 bg-white text-sm">
        {due.slice(0, 8).map((d) => (
          <li
            key={d.jobId}
            className="flex items-center justify-between px-3 py-2"
          >
            <Link
              href={`/jobs/${d.jobId}`}
              className="font-semibold text-yge-blue-700 hover:underline"
            >
              {d.projectName}
            </Link>
            <span className="text-xs text-gray-700">
              {d.lastWeekEnding ? (
                <>
                  Last filed week ending {d.lastWeekEnding} ·{' '}
                  {d.daysSince} days ago
                </>
              ) : (
                <>No CPR filed yet</>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function CprDueTile(): Promise<React.ReactElement | null> {
  try {
    return await CprDueTileInner();
  } catch (err) {
    console.error('[CprDueTile] render failed:', err);
    return null;
  }
}

