import Link from 'next/link';
import type { Job } from '@yge/shared';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs?: Job[] }).jobs ?? [];
  } catch { return []; }
}

export default async function ActiveJobsPage() {
  requirePermission('jobs:viewAll');
  const all = await fetchJobs();
  const active = all.filter((j) => j.status === 'AWARDED' || j.status === 'BID_SUBMITTED');
  active.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Active jobs" subtitle={`${active.length} job${active.length === 1 ? '' : 's'} currently active or recently awarded.`} />
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No active jobs.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {active.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/jobs/${j.id}`} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                    {j.projectName}
                  </Link>
                  <div className="text-xs text-gray-600">
                    {j.ownerAgency ?? '—'}{j.location ? ` · ${j.location}` : ''}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${j.status === 'AWARDED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                  {j.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
