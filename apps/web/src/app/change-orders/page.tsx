// /change-orders — change order log with rollup.

import Link from 'next/link';
import {
  changeOrderReasonLabel,
  changeOrderStatusLabel,
  computeChangeOrderRollup,
  formatUSD,
  type ChangeOrder,
  type ChangeOrderStatus,
  type Job,
} from '@yge/shared';

const STATUSES: ChangeOrderStatus[] = [
  'PROPOSED',
  'AGENCY_REVIEW',
  'APPROVED',
  'EXECUTED',
  'REJECTED',
  'WITHDRAWN',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchChangeOrders(filter: { jobId?: string; status?: string }): Promise<ChangeOrder[]> {
  const url = new URL(`${apiBaseUrl()}/api/change-orders`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  if (filter.status) url.searchParams.set('status', filter.status);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
}
async function fetchAll(): Promise<ChangeOrder[]> {
  const res = await fetch(`${apiBaseUrl()}/api/change-orders`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function ChangeOrdersPage({
  searchParams,
}: {
  searchParams: { jobId?: string; status?: string };
}) {
  const [changeOrders, all, jobs] = await Promise.all([
    fetchChangeOrders(searchParams),
    fetchAll(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeChangeOrderRollup(all);

  function buildHref(overrides: Partial<{ jobId?: string; status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/change-orders?${q}` : '/change-orders';
  }

  const netApprovedCents = rollup.totalApprovedAddCents - rollup.totalApprovedDeductCents;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/change-orders/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New change order
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Change orders</h1>
      <p className="mt-2 text-gray-700">
        Modifications to the awarded contract. Tracks scope, cost, and
        schedule impact through the agency review pipeline.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="In flight" value={rollup.proposed + rollup.underReview} variant={rollup.proposed + rollup.underReview > 0 ? 'warn' : 'ok'} />
        <Stat label="Approved net" value={netApprovedCents >= 0 ? `+${formatUSD(netApprovedCents)}` : `-${formatUSD(-netApprovedCents)}`} variant={netApprovedCents > 0 ? 'ok' : 'neutral'} />
        <Stat label="Schedule (days)" value={rollup.totalApprovedDays > 0 ? `+${rollup.totalApprovedDays}` : `${rollup.totalApprovedDays}`} />
        <Stat label="Executed" value={rollup.executed} variant="ok" />
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
            {changeOrderStatusLabel(s)}
          </Link>
        ))}
      </section>

      {changeOrders.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No change orders yet. Click <em>New change order</em> to start one.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Cost</th>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changeOrders.map((co) => {
                const job = jobById.get(co.jobId);
                const cost = co.totalCostImpactCents;
                return (
                  <tr key={co.id}>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">
                      {co.changeOrderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{co.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{co.jobId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {changeOrderReasonLabel(co.reason)}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium tabular-nums ${cost > 0 ? 'text-green-700' : cost < 0 ? 'text-orange-700' : 'text-gray-700'}`}>
                      {cost === 0 ? '—' : cost > 0 ? `+${formatUSD(cost)}` : `-${formatUSD(-cost)}`}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {co.totalScheduleImpactDays === 0 ? '—' : co.totalScheduleImpactDays > 0 ? `+${co.totalScheduleImpactDays}` : `${co.totalScheduleImpactDays}`}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusPill status={co.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/change-orders/${co.id}`} className="text-yge-blue-500 hover:underline">
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
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: ChangeOrderStatus }) {
  const cls =
    status === 'EXECUTED' || status === 'APPROVED'
      ? 'bg-green-100 text-green-800'
      : status === 'AGENCY_REVIEW'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'REJECTED'
          ? 'bg-red-100 text-red-800'
          : status === 'WITHDRAWN'
            ? 'bg-gray-100 text-gray-700'
            : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {changeOrderStatusLabel(status)}
    </span>
  );
}
