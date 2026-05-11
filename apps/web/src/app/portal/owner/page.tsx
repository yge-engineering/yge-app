// /portal/owner — owner / agency landing page.
//
// External users (EXTERNAL_OWNER role). Lists the jobs YGE is
// running for this owner, with each card linking to a read-only
// project view.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Money } from '../../../components/money';
import { getCurrentUser } from '../../../lib/auth';
import { currentUserCan } from '../../../lib/permissions';
import {
  bidDueCountdown,
  type ChangeOrder,
  type DailyReport,
  type Job,
  type Photo,
  type PortalUser,
  type Rfi,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAssigned(email: string): Promise<{
  user: PortalUser | null;
  jobs: Job[];
}> {
  if (!email) return { user: null, jobs: [] };
  let user: PortalUser | null = null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as { user?: PortalUser };
      user = body.user ?? null;
    }
  } catch {
    /* swallow */
  }
  if (!user) return { user: null, jobs: [] };

  const ids = user.assignedJobIds ?? [];
  if (ids.length === 0) return { user, jobs: [] };

  // Resolve each assigned job by id. Sequential is fine — owners
  // typically have a handful of active projects, not hundreds.
  const jobs: Job[] = [];
  for (const id of ids) {
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) continue;
      const body = (await res.json()) as { job?: Job };
      if (body.job) jobs.push(body.job);
    } catch {
      /* swallow — keep going */
    }
  }
  return { user, jobs };
}

async function fetchJson<T>(path: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

interface JobActivity {
  lastReportDate: string | null;
  lastPhotoDate: string | null;
}

function buildActivityMap(
  reports: DailyReport[],
  photos: Photo[],
): Map<string, JobActivity> {
  const m = new Map<string, JobActivity>();
  for (const r of reports) {
    const cur = m.get(r.jobId) ?? { lastReportDate: null, lastPhotoDate: null };
    if (!cur.lastReportDate || r.date > cur.lastReportDate) cur.lastReportDate = r.date;
    m.set(r.jobId, cur);
  }
  for (const p of photos) {
    const cur = m.get(p.jobId) ?? { lastReportDate: null, lastPhotoDate: null };
    if (!cur.lastPhotoDate || p.takenOn > cur.lastPhotoDate) cur.lastPhotoDate = p.takenOn;
    m.set(p.jobId, cur);
  }
  return m;
}

function daysAgo(isoDate: string | null, now: Date): number | null {
  if (!isoDate) return null;
  const t = Date.parse(isoDate + 'T00:00:00');
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

export default async function OwnerPortalPage() {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const { user, jobs } = await fetchAssigned(me?.email ?? '');
  const [reports, photos, rfis, changeOrders] = await Promise.all([
    fetchJson<DailyReport>('/api/daily-reports', 'reports'),
    fetchJson<Photo>('/api/photos', 'photos'),
    fetchJson<Rfi>('/api/rfis', 'rfis'),
    fetchJson<ChangeOrder>('/api/change-orders', 'orders'),
  ]);
  const activity = buildActivityMap(reports, photos);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const assignedSet = new Set((user?.assignedJobIds ?? []) as string[]);
  const photos7d = photos.filter(
    (p) => assignedSet.has(p.jobId) && p.takenOn >= sevenDaysAgo,
  ).length;
  const openRfis = rfis.filter(
    (r) =>
      assignedSet.has(r.jobId) &&
      r.status !== 'CLOSED' &&
      r.status !== 'WITHDRAWN' &&
      r.status !== 'ANSWERED',
  ).length;
  const pendingCos = changeOrders.filter(
    (c) =>
      assignedSet.has(c.jobId) &&
      (c.status === 'PROPOSED' || c.status === 'AGENCY_REVIEW'),
  ).length;

  const sorted = [...jobs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-yge-blue-900">
              Young General Engineering — owner portal
            </h1>
            <p className="text-xs text-gray-600">
              Welcome, {me?.name ?? me?.email ?? 'owner'}. Read-only view
              of the projects we're running for you.
            </p>
          </div>
          <Link
            href="/api/auth/logout"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {sorted.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No projects assigned to you yet. If this looks wrong, email{' '}
            <a
              href="mailto:office@youngge.com"
              className="text-yge-blue-700 underline"
            >
              office@youngge.com
            </a>{' '}
            and we'll wire up access.
          </div>
        ) : (
          <>
            <section className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Photos last 7 days</div>
                <div className="mt-1 font-mono text-2xl font-bold text-yge-blue-900">
                  {photos7d}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Open RFIs</div>
                <div
                  className={`mt-1 font-mono text-2xl font-bold ${
                    openRfis > 0 ? 'text-amber-800' : 'text-yge-blue-900'
                  }`}
                >
                  {openRfis}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Pending change orders</div>
                <div
                  className={`mt-1 font-mono text-2xl font-bold ${
                    pendingCos > 0 ? 'text-amber-800' : 'text-yge-blue-900'
                  }`}
                >
                  {pendingCos}
                </div>
              </div>
            </section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Your projects ({sorted.length})
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sorted.map((j) => {
                const due = j.bidDueDate
                  ? bidDueCountdown(j.bidDueDate, new Date())
                  : null;
                return (
                  <li key={j.id}>
                    <Link
                      href={`/portal/owner/jobs/${j.id}`}
                      className="block rounded-md border border-gray-200 bg-white p-4 hover:border-yge-blue-500 hover:bg-yge-blue-50"
                    >
                      <div className="font-semibold text-gray-900">
                        {j.projectName}
                      </div>
                      {j.location ? (
                        <div className="mt-0.5 text-xs text-gray-600">
                          {j.location}
                        </div>
                      ) : null}
                      {(() => {
                        const a = activity.get(j.id);
                        const reportAge = daysAgo(a?.lastReportDate ?? null, now);
                        const photoAge = daysAgo(a?.lastPhotoDate ?? null, now);
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {reportAge != null ? (
                              <span
                                className={`rounded-full px-2 py-0.5 ${
                                  reportAge === 0
                                    ? 'bg-green-100 text-green-900'
                                    : reportAge <= 7
                                      ? 'bg-gray-100 text-gray-700'
                                      : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                Last report: {reportAge === 0 ? 'today' : `${reportAge}d ago`}
                              </span>
                            ) : null}
                            {photoAge != null ? (
                              <span
                                className={`rounded-full px-2 py-0.5 ${
                                  photoAge === 0
                                    ? 'bg-green-100 text-green-900'
                                    : photoAge <= 7
                                      ? 'bg-gray-100 text-gray-700'
                                      : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                Last photo: {photoAge === 0 ? 'today' : `${photoAge}d ago`}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-gray-700">
                          {j.status}
                        </span>
                        {j.engineersEstimateCents != null ? (
                          <span className="text-gray-700">
                            <Money cents={j.engineersEstimateCents} /> EE
                          </span>
                        ) : null}
                        {due ? (
                          <span
                            className={
                              due.level === 'red'
                                ? 'font-semibold text-red-700'
                                : due.level === 'orange' ||
                                    due.level === 'yellow'
                                  ? 'font-semibold text-amber-700'
                                  : 'text-gray-600'
                            }
                          >
                            Bid due {j.bidDueDate}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {user ? (
          <p className="mt-6 text-[11px] text-gray-500">
            Signed in as {user.email} · role {user.role}. Have a question
            on a project? Email the YGE PM listed on the project page or
            office@youngge.com.
          </p>
        ) : null}
      </div>
    </main>
  );
}
