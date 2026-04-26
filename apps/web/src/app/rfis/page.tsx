// /rfis — RFI list with rollup + filters.

import Link from 'next/link';
import {
  computeRfiRollup,
  rfiDaysOutstanding,
  rfiPriorityLabel,
  rfiStatusLabel,
  rfiUrgency,
  type Job,
  type Rfi,
  type RfiStatus,
} from '@yge/shared';

const STATUSES: RfiStatus[] = ['DRAFT', 'SENT', 'ANSWERED', 'CLOSED', 'WITHDRAWN'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRfis(filter: { jobId?: string; status?: string }): Promise<Rfi[]> {
  const url = new URL(`${apiBaseUrl()}/api/rfis`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  if (filter.status) url.searchParams.set('status', filter.status);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { rfis: Rfi[] }).rfis;
}
async function fetchAllRfis(): Promise<Rfi[]> {
  const res = await fetch(`${apiBaseUrl()}/api/rfis`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { rfis: Rfi[] }).rfis;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function RfisPage({
  searchParams,
}: {
  searchParams: { jobId?: string; status?: string };
}) {
  const [rfis, all, jobs] = await Promise.all([
    fetchRfis(searchParams),
    fetchAllRfis(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeRfiRollup(all);

  function buildHref(overrides: Partial<{ jobId?: string; status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/rfis?${q}` : '/rfis';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/rfis/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New RFI
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Requests for Information</h1>
      <p className="mt-2 text-gray-700">
        Questions for the agency / engineer / owner with their written
        responses. Status pipeline DRAFT → SENT → ANSWERED → CLOSED.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Open" value={rollup.open} variant={rollup.open > 0 ? 'warn' : 'ok'} />
        <Stat label="Overdue" value={rollup.overdue} variant={rollup.overdue > 0 ? 'bad' : 'ok'} />
        <Stat label="Answered" value={rollup.answered} variant="ok" />
        <Stat
          label="Avg response (days)"
          value={rollup.averageResponseDays > 0 ? rollup.averageResponseDays.toFixed(1) : '—'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
        <Link
          href={buildHref({ status: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {rfiStatusLabel(s)}
          </Link>
        ))}
      </section>

      {rfis.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No RFIs match. Click <em>New RFI</em> to log one.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Sent</th>
                <th className="px-4 py-2">Days out</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rfis.map((r) => {
                const urg = rfiUrgency(r);
                const days = rfiDaysOutstanding(r);
                const job = jobById.get(r.jobId);
                const rowClass =
                  urg === 'overdue'
                    ? 'bg-red-50'
                    : urg === 'dueSoon'
                      ? 'bg-yellow-50'
                      : '';
                return (
                  <tr key={r.id} className={rowClass}>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">
                      {r.rfiNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.subject}</div>
                      {(r.costImpact || r.scheduleImpact) && (
                        <div className="mt-0.5 text-xs">
                          {r.costImpact && (
                            <span className="mr-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                              cost
                            </span>
                          )}
                          {r.scheduleImpact && (
                            <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                              schedule
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{r.jobId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.sentAt ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {days === undefined ? <span className="text-gray-400">—</span> : `${days} d`}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <PriorityPill priority={r.priority} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/rfis/${r.id}`} className="text-yge-blue-500 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Rfi['status'] }) {
  const cls =
    status === 'ANSWERED'
      ? 'bg-blue-100 text-blue-800'
      : status === 'CLOSED'
        ? 'bg-green-100 text-green-800'
        : status === 'WITHDRAWN'
          ? 'bg-gray-100 text-gray-700'
          : status === 'SENT'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {rfiStatusLabel(status)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Rfi['priority'] }) {
  const cls =
    priority === 'CRITICAL'
      ? 'bg-red-100 text-red-800'
      : priority === 'HIGH'
        ? 'bg-orange-100 text-orange-800'
        : priority === 'MEDIUM'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {rfiPriorityLabel(priority)}
    </span>
  );
}
