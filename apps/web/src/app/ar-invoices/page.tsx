// /ar-invoices — outgoing customer/agency bills.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  arInvoiceStatusLabel,
  arUnpaidBalanceCents,
  computeArRollup,
  formatUSD,
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
  const url = new URL(`${apiBaseUrl()}/api/ar-invoices`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
}
async function fetchAllInvoices(): Promise<ArInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
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

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/ar-invoices?format=csv${searchParams.status ? '&status=' + encodeURIComponent(searchParams.status) : ''}${searchParams.jobId ? '&jobId=' + encodeURIComponent(searchParams.jobId) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/ar-invoices/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + New invoice
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Customer invoices (AR)</h1>
      <p className="mt-2 text-gray-700">
        Outgoing bills to customers and agencies. Pull line items from
        daily reports for monthly billing (e.g. Cal Fire), or build manually
        for progress + lump-sum jobs.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Outstanding" value={formatUSD(rollup.outstandingCents)} variant={rollup.outstandingCents > 0 ? 'warn' : 'ok'} />
        <Stat label="Drafts" value={rollup.draft} />
        <Stat label="Sent" value={rollup.sent} />
        <Stat label="Paid (lifetime)" value={formatUSD(rollup.paidCents)} variant="ok" />
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
            {arInvoiceStatusLabel(s)}
          </Link>
        ))}
      </section>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No invoices match. Click <em>New invoice</em> to create one.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const job = jobById.get(inv.jobId);
                const balance = arUnpaidBalanceCents(inv);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.customerName}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{inv.jobId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {inv.billingPeriodStart && inv.billingPeriodEnd
                        ? `${inv.billingPeriodStart} → ${inv.billingPeriodEnd}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{inv.invoiceDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatUSD(inv.totalCents)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {balance > 0 ? formatUSD(balance) : <span className="text-gray-400">paid</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/ar-invoices/${inv.id}`} className="text-yge-blue-500 hover:underline">
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
    </AppShell>
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

function StatusPill({ status }: { status: ArInvoiceStatus }) {
  const cls =
    status === 'PAID'
      ? 'bg-green-100 text-green-800'
      : status === 'PARTIALLY_PAID' || status === 'SENT'
        ? 'bg-blue-100 text-blue-800'
        : status === 'DISPUTED'
          ? 'bg-red-100 text-red-800'
          : status === 'WRITTEN_OFF'
            ? 'bg-gray-200 text-gray-600'
            : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {arInvoiceStatusLabel(status)}
    </span>
  );
}
