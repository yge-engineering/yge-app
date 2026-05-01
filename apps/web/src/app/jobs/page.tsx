// /jobs — list of every job in the pursuit pipeline.
//
// Server component: fetches the full list at request time. The Job model is
// small (just metadata), so a single GET /api/jobs round-trip is plenty.

import Link from 'next/link';

import { Alert, AppShell, Money } from '../../components';
import {
  contractTypeLabel,
  statusLabel,
  type Job,
  type JobStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { jobs: Job[] };
  return json.jobs;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Color the status pill so the dashboard view tells you at a glance whether
// a job is still in active pursuit or already closed out.
function statusPillClass(status: JobStatus): string {
  switch (status) {
    case 'PROSPECT':
      return 'bg-gray-100 text-gray-800';
    case 'PURSUING':
      return 'bg-yellow-100 text-yellow-800';
    case 'BID_SUBMITTED':
      return 'bg-blue-100 text-blue-800';
    case 'AWARDED':
      return 'bg-green-100 text-green-800';
    case 'LOST':
      return 'bg-red-100 text-red-800';
    case 'NO_BID':
      return 'bg-gray-200 text-gray-700';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-500';
  }
}

interface PageProps {
  searchParams?: { status?: string };
}

const FILTER_PRESETS: { label: string; value: string; matches: (s: JobStatus) => boolean }[] = [
  { label: 'All', value: 'all', matches: () => true },
  { label: 'Active', value: 'active', matches: (s) => s === 'PURSUING' || s === 'BID_SUBMITTED' || s === 'AWARDED' },
  { label: 'Pursuing', value: 'PURSUING', matches: (s) => s === 'PURSUING' },
  { label: 'Bid submitted', value: 'BID_SUBMITTED', matches: (s) => s === 'BID_SUBMITTED' },
  { label: 'Awarded', value: 'AWARDED', matches: (s) => s === 'AWARDED' },
  { label: 'Lost / no bid', value: 'lost', matches: (s) => s === 'LOST' || s === 'NO_BID' },
  { label: 'Archived', value: 'ARCHIVED', matches: (s) => s === 'ARCHIVED' },
];

export default async function JobsPage({ searchParams }: PageProps) {
  let jobs: Job[] = [];
  let fetchError: string | null = null;
  try {
    jobs = await fetchJobs();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error';
  }

  const filterValue = searchParams?.status ?? 'active';
  const preset = FILTER_PRESETS.find((p) => p.value === filterValue) ?? FILTER_PRESETS[1];
  const filteredJobs = preset ? jobs.filter((j) => preset.matches(j.status)) : jobs;

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/jobs/new"
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
        >
          + New job
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Jobs</h1>
      <p className="mt-2 text-gray-700">
        Every project YGE is tracking — prospects, active pursuits, submitted bids, and
        awarded jobs. Open one to see its drafts and priced estimates.
      </p>

      {/* Filter pills */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTER_PRESETS.map((p) => {
          const active = p.value === filterValue;
          return (
            <Link
              key={p.value}
              href={p.value === 'all' ? '/jobs' : `/jobs?status=${p.value}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-blue-700 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {fetchError && (
        <Alert tone="danger" className="mt-6" title="Couldn&rsquo;t load jobs from the API">
          {fetchError}. Make sure the API server is running on port 4000.
        </Alert>
      )}

      {!fetchError && jobs.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No jobs yet.{' '}
          <Link href="/jobs/new" className="text-yge-blue-500 hover:underline">
            Create your first one &rarr;
          </Link>
        </div>
      )}

      {!fetchError && jobs.length > 0 && filteredJobs.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No jobs match the &ldquo;{preset?.label}&rdquo; filter.{' '}
          <Link href="/jobs?status=all" className="text-yge-blue-500 hover:underline">
            Show all &rarr;
          </Link>
        </div>
      )}

      {filteredJobs.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Contract</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Engineer&rsquo;s estimate</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{j.projectName}</div>
                    {j.ownerAgency && (
                      <div className="text-xs text-gray-500">{j.ownerAgency}</div>
                    )}
                    {j.location && (
                      <div className="text-xs text-gray-500">{j.location}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPillClass(
                        j.status,
                      )}`}
                    >
                      {statusLabel(j.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.projectType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {contractTypeLabel(j.contractType)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.bidDueDate ? formatWhen(j.bidDueDate) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.engineersEstimateCents !== undefined ? (
                      <Money cents={j.engineersEstimateCents} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/jobs/${j.id}`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}
