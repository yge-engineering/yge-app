// /ap-invoices — vendor bill list with rollup + status filters.

import Link from 'next/link';
import {
  apDueLevel,
  apStatusLabel,
  computeApInvoiceRollup,
  formatUSD,
  unpaidBalanceCents,
  type ApInvoice,
  type ApInvoiceStatus,
  type Job,
} from '@yge/shared';

const STATUSES: ApInvoiceStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInvoices(filter: { status?: string; jobId?: string }): Promise<ApInvoice[]> {
  const url = new URL(`${apiBaseUrl()}/api/ap-invoices`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
}
async function fetchAllInvoices(): Promise<ApInvoice[]> {
  // Always fetched unfiltered so the rollup tiles reflect totals across all
  // statuses regardless of the filter.
  const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function ApInvoicesPage({
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
  const rollup = computeApInvoiceRollup(all);

  function buildHref(overrides: Partial<{ status?: string; jobId?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/ap-invoices?${q}` : '/ap-invoices';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/ap-invoices/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New invoice
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">AP invoices</h1>
      <p className="mt-2 text-gray-700">
        Vendor bills. Manual entry for Phase 1; AI-scan from a PDF lands in
        a later phase that drops the same shape into the create endpoint.
      </p>

      {/* Rollup */}
      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat
          label="Outstanding"
          value={formatUSD(rollup.outstandingCents)}
          subtitle={`${rollup.draft + rollup.pending + rollup.approved} invoice(s)`}
          variant={rollup.outstandingCents > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Overdue"
          value={formatUSD(rollup.overdueCents)}
          variant={rollup.overdueCents > 0 ? 'bad' : 'ok'}
        />
        <Stat label="Pending approval" value={rollup.pending} />
        <Stat label="Paid (lifetime)" value={rollup.paid} variant="ok" />
      </section>

      {/* Filters */}
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
            {apStatusLabel(s)}
          </Link>
        ))}
      </section>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No invoices match. Click <em>New invoice</em> to log a bill.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Invoice #</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const lvl = apDueLevel(inv);
                const job = inv.jobId ? jobById.get(inv.jobId) : undefined;
                const balance = unpaidBalanceCents(inv);
                const rowClass =
                  lvl === 'overdue'
                    ? 'bg-red-50'
                    : lvl === 'dueSoon'
                      ? 'bg-yellow-50'
                      : '';
                return (
                  <tr key={inv.id} className={rowClass}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.vendorName}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {inv.invoiceNumber ?? <span className="text-gray-400 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{inv.invoiceDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {inv.dueDate ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatUSD(inv.totalCents)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {balance > 0 ? formatUSD(balance) : <span className="text-gray-400">paid</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/ap-invoices/${inv.id}`} className="text-yge-blue-500 hover:underline">
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
  subtitle,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
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
      {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: ApInvoiceStatus }) {
  const cls =
    status === 'PAID'
      ? 'bg-green-100 text-green-800'
      : status === 'APPROVED'
        ? 'bg-blue-100 text-blue-800'
        : status === 'PENDING'
          ? 'bg-yellow-100 text-yellow-800'
          : status === 'REJECTED'
            ? 'bg-red-100 text-red-800'
            : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {apStatusLabel(status)}
    </span>
  );
}
