import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Job { id: string; projectName?: string; jobNumber?: string; status?: string; ownerAgency?: string | null; updatedAt?: string }

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

export default async function AwardedJobsPage() {
  requirePermission('jobs:viewAll');
  const all = await fetchJobs();
  const rows = all.filter((j) => j.status === 'AWARDED');
  rows.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Awarded jobs" subtitle={`${rows.length} job${rows.length === 1 ? '' : 's'} currently in AWARDED status.`} />
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No awarded jobs.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {rows.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/jobs/${j.id}`} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                    {j.projectName ?? j.id}
                  </Link>
                  <div className="text-xs text-gray-600">
                    {j.ownerAgency ?? '—'}{j.jobNumber ? ` · ${j.jobNumber}` : ''}
                  </div>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                  AWARDED
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
