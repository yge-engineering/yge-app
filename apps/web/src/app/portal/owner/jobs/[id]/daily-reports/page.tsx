// /portal/owner/jobs/[id]/daily-reports — full DR list grouped by month.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '../../../../../../lib/auth';
import { currentUserCan } from '../../../../../../lib/permissions';
import { type DailyReport, type PortalUser } from '@yge/shared';

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

async function fetchReports(): Promise<DailyReport[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/daily-reports`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { reports: DailyReport[] }).reports;
  } catch {
    return [];
  }
}

export default async function OwnerDailyReportsPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const user = await fetchPortalUser(me?.email ?? '');
  if (!user) redirect('/portal/owner');
  if (!(user.assignedJobIds ?? []).includes(params.id)) notFound();

  const all = await fetchReports();
  const reports = all
    .filter((r) => r.jobId === params.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Group by month for visual structure.
  const byMonth = new Map<string, DailyReport[]>();
  for (const r of reports) {
    const ym = r.date.slice(0, 7);
    const list = byMonth.get(ym) ?? [];
    list.push(r);
    byMonth.set(ym, list);
  }
  const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/portal/owner/jobs/${params.id}`}
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            All daily reports ({reports.length})
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {reports.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No daily reports filed on this project yet.
          </p>
        ) : (
          months.map((ym) => (
            <section key={ym}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {ym} · {byMonth.get(ym)!.length} report
                {byMonth.get(ym)!.length === 1 ? '' : 's'}
              </h2>
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white text-sm">
                {byMonth.get(ym)!.map((r) => (
                  <li key={r.id} className="p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-xs text-gray-700">
                        {r.date}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        {r.weather ?? ''}
                        {r.temperatureF != null
                          ? ` · ${r.temperatureF}°F`
                          : ''}
                      </span>
                    </div>
                    {r.scopeCompleted ? (
                      <p className="mt-1 text-sm text-gray-900">
                        {r.scopeCompleted}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">
                        (no narrative)
                      </p>
                    )}
                    {r.issues ? (
                      <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        <strong>Issues:</strong> {r.issues}
                      </p>
                    ) : null}
                    {r.visitors ? (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Visitors: {r.visitors}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
