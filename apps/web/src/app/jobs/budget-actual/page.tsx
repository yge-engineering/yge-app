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

export default async function BudgetActualJobsPage() {
  requirePermission('financials:view');
  const all = await fetchJobs();
  const eligible = all.filter((j) => j.status === 'AWARDED' || j.status === 'ARCHIVED' || j.status === 'BID_SUBMITTED');

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Budget vs actual — pick a job" subtitle="Per-job budget breakdown by category." />
        {eligible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No eligible jobs yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {eligible.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <Link href={`/jobs/${j.id}`} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                  {j.projectName}
                </Link>
                <span className="text-xs text-gray-500">{j.status}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
