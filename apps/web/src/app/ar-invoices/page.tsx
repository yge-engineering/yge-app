// /ar-invoices — outgoing customer/agency bills.
//
// Plain English: outgoing bills to customers and agencies. Pull line
// items from daily reports for monthly billing (e.g. Cal Fire), or
// build manually for progress + lump-sum jobs. Outstanding dollars
// are the page's whole point — that number drives the cash forecast.

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
  arInvoiceStatusLabel,
  arUnpaidBalanceCents,
  computeArRollup,
  type ArInvoice,
  type ArInvoiceStatus,
  type Job,
} from '@yge/shared';

const STATUSES: ArInvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'WRITTEN_OFF'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchInvoices(filter: { status?: string; jobId?: string }): Promise<ArInvoice[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/ar-invoices`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchAllInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function statusTone(s: ArInvoiceStatus): 'success' | 'info' | 'danger' | 'muted' | 'neutral' {
  switch (s) {
    case 'PAID': return 'success';
    case 'PARTIALLY_PAID':
    case 'SENT': return 'info';
    case 'DISPUTED': return 'danger';
    case 'WRITTEN_OFF': return 'muted';
    default: return 'neutral';
  }
}

export default async function ArInvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [invoices, all, jobs] = await Promise.all([
    fetchInvoices(searchParams),
    fetchAllInvoices(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeArRollup(all);

  function buildHref(overrides: Partial<{ status?: string; jobId?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/ar-invoices?${q}` : '/ar-invoices';
  }

  const csvHref = `${publicApiBaseUrl()}/api/ar-invoices?format=csv${
    searchParams.status ? '&status=' + encodeURIComponent(searchParams.status) : ''
  }${searchParams.jobId ? '&jobId=' + encodeURIComponent(searchParams.jobId) : ''}`;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Customer invoices (AR)"
          subtitle="Outgoing bills to customers and agencies. Pull line items from daily reports for monthly billing (e.g. Cal Fire), or build manually for progress + lump-sum jobs."
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Download CSV
              </a>
              <LinkButton href="/ar-invoices/new" variant="primary" size="md">
                + New invoice
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile
            label="Outstanding"
            value={<Money cents={rollup.outstandingCents} />}
            tone={rollup.outstandingCents > 0 ? 'warn' : 'success'}
          />
          <Tile label="Drafts" value={rollup.draft} />
          <Tile label="Sent" value={rollup.sent} />
          <Tile label="Paid (lifetime)" value={<Money cents={rollup.paidCents} />} tone="success" />
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
              {arInvoiceStatusLabel(s)}
            </Link>
          ))}
        </section>

        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices match"
            body="Create one from a daily-report rollup or as a one-off progress / lump-sum bill. Anything you bill here flows into the cash forecast."
            actions={[{ href: '/ar-invoices/new', label: 'New invoice', primary: true }]}
          />
        ) : (
          <DataTable
            rows={invoices}
            keyFn={(inv) => inv.id}
            columns={[
              {
                key: 'invoiceNumber',
                header: '#',
                cell: (inv) => (
                  <Link href={`/ar-invoices/${inv.id}`} className="font-mono font-bold text-blue-700 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                ),
              },
              { key: 'customer', header: 'Customer', cell: (inv) => <span className="font-medium text-gray-900">{inv.customerName}</span> },
              {
                key: 'job',
                header: 'Job',
                cell: (inv) => {
                  const job = jobById.get(inv.jobId);
                  return job
                    ? <Link href={`/jobs/${job.id}`} className="text-sm text-blue-700 hover:underline">{job.projectName}</Link>
                    : <span className="text-sm text-gray-400">{inv.jobId}</span>;
                },
              },
              {
                key: 'period',
                header: 'Period',
                cell: (inv) => inv.billingPeriodStart && inv.billingPeriodEnd
                  ? <span className="text-xs text-gray-700">{inv.billingPeriodStart} → {inv.billingPeriodEnd}</span>
                  : <span className="text-xs text-gray-400">—</span>,
              },
              { key: 'date', header: 'Date', cell: (inv) => <span className="font-mono text-xs text-gray-700">{inv.invoiceDate}</span> },
              { key: 'total', header: 'Total', numeric: true, cell: (inv) => <Money cents={inv.totalCents} /> },
              {
                key: 'balance',
                header: 'Balance',
                numeric: true,
                cell: (inv) => {
                  const balance = arUnpaidBalanceCents(inv);
                  return balance > 0 ? <Money cents={balance} className="font-semibold" /> : <span className="text-sm text-gray-400">paid</span>;
                },
              },
              { key: 'status', header: 'Status', cell: (inv) => <StatusPill label={arInvoiceStatusLabel(inv.status)} tone={statusTone(inv.status)} /> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
