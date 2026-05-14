import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Job { id: string; projectName?: string; jobNumber?: string; status?: string; ownerAgency?: string | null; createdAt?: string }

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

export default async function JobsThisQuarterPage() {
  requirePermission('jobs:viewAll');
  const all = await fetchJobs();
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const qStart = new Date(year, (q - 1) * 3, 1).toISOString().slice(0, 10);
  const qEnd = new Date(year, q * 3, 1).toISOString().slice(0, 10);

  const rows = all
    .filter((j) => (j.createdAt ?? '') >= qStart && (j.createdAt ?? '') < qEnd)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title={`Jobs created in ${year} Q${q}`} subtitle={`${rows.length} job${rows.length === 1 ? '' : 's'} so far this quarter.`} />
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No jobs created in {year} Q{q} yet.
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
                    {j.ownerAgency ?? '—'}{j.jobNumber ? ` · ${j.jobNumber}` : ''} · created {(j.createdAt ?? '').slice(0, 10)}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                  {j.status ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
