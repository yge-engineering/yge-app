// /change-orders — change order log with rollup.
//
// Plain English: modifications to the awarded contract. Tracks scope,
// cost, and schedule impact through the agency review pipeline.
// Approved-net dollars roll into job profitability + WIP, so this is
// where the "we got the CO" upside actually shows.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  changeOrderReasonLabel,
  changeOrderStatusLabel,
  computeChangeOrderRollup,
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/change-orders`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
  } catch { return []; }
}
async function fetchAll(): Promise<ChangeOrder[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/change-orders`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { changeOrders: ChangeOrder[] }).changeOrders;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function statusTone(s: ChangeOrderStatus): 'success' | 'info' | 'warn' | 'danger' | 'muted' {
  switch (s) {
    case 'EXECUTED':
    case 'APPROVED': return 'success';
    case 'AGENCY_REVIEW': return 'warn';
    case 'REJECTED': return 'danger';
    case 'WITHDRAWN': return 'muted';
    case 'PROPOSED': return 'info';
  }
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
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Change orders"
          subtitle="Modifications to the awarded contract. Tracks scope, cost, and schedule impact through the agency review pipeline."
          actions={
            <LinkButton href="/change-orders/new" variant="primary" size="md">
              + New change order
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile
            label="In flight"
            value={rollup.proposed + rollup.underReview}
            tone={rollup.proposed + rollup.underReview > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Approved net"
            value={<Money cents={netApprovedCents} />}
            tone={netApprovedCents > 0 ? 'success' : 'neutral'}
          />
          <Tile
            label="Schedule (days)"
            value={rollup.totalApprovedDays > 0 ? `+${rollup.totalApprovedDays}` : `${rollup.totalApprovedDays}`}
          />
          <Tile label="Executed" value={rollup.executed} tone="success" />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {changeOrderStatusLabel(s)}
            </Link>
          ))}
        </section>

        {changeOrders.length === 0 ? (
          <EmptyState
            title="No change orders yet"
            body="Capture every directive, RFI-driven scope shift, and field change here. The dollars on approved COs feed straight into job profitability."
            actions={[{ href: '/change-orders/new', label: 'New change order', primary: true }]}
          />
        ) : (
          <DataTable
            rows={changeOrders}
            keyFn={(co) => co.id}
            columns={[
              {
                key: 'number',
                header: '#',
                cell: (co) => (
                  <Link href={`/change-orders/${co.id}`} className="font-mono text-sm font-bold text-blue-700 hover:underline">
                    {co.changeOrderNumber}
                  </Link>
                ),
              },
              { key: 'subject', header: 'Subject', cell: (co) => <div className="font-medium text-gray-900">{co.subject}</div> },
              {
                key: 'job',
                header: 'Job',
                cell: (co) => {
                  const job = jobById.get(co.jobId);
                  return job
                    ? <Link href={`/jobs/${job.id}`} className="text-sm text-blue-700 hover:underline">{job.projectName}</Link>
                    : <span className="text-sm text-gray-400">{co.jobId}</span>;
                },
              },
              { key: 'reason', header: 'Reason', cell: (co) => <span className="text-xs text-gray-600">{changeOrderReasonLabel(co.reason)}</span> },
              {
                key: 'cost',
                header: 'Cost',
                numeric: true,
                cell: (co) => {
                  const cost = co.totalCostImpactCents;
                  if (cost === 0) return <span className="font-mono text-gray-400">—</span>;
                  return (
                    <Money
                      cents={cost}
                      className={cost > 0 ? 'font-medium text-emerald-700' : 'font-medium text-orange-700'}
                    />
                  );
                },
              },
              {
                key: 'days',
                header: 'Days',
                numeric: true,
                cell: (co) => co.totalScheduleImpactDays === 0
                  ? <span className="font-mono text-gray-400">—</span>
                  : <span className="font-mono">{co.totalScheduleImpactDays > 0 ? `+${co.totalScheduleImpactDays}` : `${co.totalScheduleImpactDays}`}</span>,
              },
              { key: 'status', header: 'Status', cell: (co) => <StatusPill label={changeOrderStatusLabel(co.status)} tone={statusTone(co.status)} /> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
