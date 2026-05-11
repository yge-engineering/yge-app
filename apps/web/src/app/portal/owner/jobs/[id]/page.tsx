// /portal/owner/jobs/[id] — read-only project view for the agency.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Money } from '../../../../../components/money';
import { getCurrentUser } from '../../../../../lib/auth';
import { currentUserCan } from '../../../../../lib/permissions';
import {
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

async function fetchPortalUser(email: string): Promise<PortalUser | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: PortalUser };
    return body.user ?? null;
  } catch {
    return null;
  }
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

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { job?: Job };
    return body.job ?? null;
  } catch {
    return null;
  }
}

export default async function OwnerPortalJobPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const user = await fetchPortalUser(me?.email ?? '');
  if (!user) {
    redirect('/portal/owner');
  }
  const assigned = user.assignedJobIds ?? [];
  if (!assigned.includes(params.id)) {
    // Don't reveal job details to an external user that isn't
    // explicitly assigned to it.
    notFound();
  }

  const [job, allReports, allPhotos, allRfis, allCos] = await Promise.all([
    fetchJob(params.id),
    fetchJson<DailyReport>('/api/daily-reports', 'reports'),
    fetchJson<Photo>(
      `/api/photos?jobId=${encodeURIComponent(params.id)}`,
      'photos',
    ),
    fetchJson<Rfi>('/api/rfis', 'rfis'),
    fetchJson<ChangeOrder>('/api/change-orders', 'orders'),
  ]);
  if (!job) notFound();

  const reports = allReports
    .filter((r) => r.jobId === params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const photos = allPhotos
    .sort((a, b) => b.takenOn.localeCompare(a.takenOn))
    .slice(0, 12);
  const rfis = allRfis
    .filter((r) => r.jobId === params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);
  const cos = allCos
    .filter((c) => c.jobId === params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/portal/owner"
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← All projects
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-900">
            {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            {job.ownerAgency ? `${job.ownerAgency} · ` : ''}
            {job.location ?? ''}
            {' · status '}
            {job.status}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Project summary
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Engineer's estimate</dt>
              <dd className="font-mono">
                {job.engineersEstimateCents != null ? (
                  <Money cents={job.engineersEstimateCents} />
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Bid due</dt>
              <dd className="font-mono">{job.bidDueDate ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Project type</dt>
              <dd>{job.projectType}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Pursuit owner (YGE)</dt>
              <dd>{job.pursuitOwner ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent daily reports
          </h2>
          {reports.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No reports filed yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {reports.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <span className="font-mono text-xs text-gray-700">
                    {r.date}
                  </span>{' '}
                  <span className="text-gray-900">
                    {r.scopeCompleted
                      ? r.scopeCompleted.length > 120
                        ? r.scopeCompleted.slice(0, 120) + '…'
                        : r.scopeCompleted
                      : '(no narrative)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recent photos ({photos.length})
            </h2>
            {photos.length > 0 ? (
              <a
                href={`/portal/owner/jobs/${params.id}/photos`}
                className="text-xs text-yge-blue-700 hover:underline"
              >
                See all photos →
              </a>
            ) : null}
          </div>
          {photos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No photos yet.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <a
                  key={p.id}
                  href={`/portal/owner/photos/${p.id}`}
                  className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100 text-center text-[10px] text-gray-600 hover:border-yge-blue-500"
                >
                  <div className="px-1 py-2 font-semibold uppercase tracking-wide text-gray-500">
                    {p.category}
                  </div>
                  <div className="px-1 text-[10px]">
                    {p.takenOn}
                    {p.caption ? ` · ${p.caption.slice(0, 40)}` : ''}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Open RFIs ({rfis.length})
            </h2>
            {rfis.length > 0 ? (
              <a
                href={`/portal/owner/jobs/${params.id}/rfis`}
                className="text-xs text-yge-blue-700 hover:underline"
              >
                See all RFIs →
              </a>
            ) : null}
          </div>
          {rfis.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No RFIs yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {rfis.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <span className="font-mono text-xs text-gray-700">
                    #{r.rfiNumber}
                  </span>{' '}
                  <span className="text-gray-900">
                    {r.subject || r.question.slice(0, 80)}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Change orders ({cos.length})
          </h2>
          {cos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No change orders yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {cos.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <span className="font-mono text-xs text-gray-700">
                    #{c.changeOrderNumber}
                  </span>{' '}
                  <span className="text-gray-900">
                    {c.subject.slice(0, 100)}
                  </span>
                  <span className="ml-2 font-mono text-xs text-gray-700">
                    <Money cents={c.totalCostImpactCents} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-gray-500">
          Read-only view. To change anything, message your YGE PM
          {job.pursuitOwner ? ` (${job.pursuitOwner})` : ''} or email{' '}
          <a
            href="mailto:office@youngge.com"
            className="text-yge-blue-700 underline"
          >
            office@youngge.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
