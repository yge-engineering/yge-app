// /retention — retention dashboard rolled up from AR invoices + payments.

import Link from 'next/link';
import {
  buildJobRetentionStatus,
  computeRetentionRollup,
  formatUSD,
  type ArInvoice,
  type ArPayment,
  type JobRetentionStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInvoices(): Promise<ArInvoice[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
}

async function fetchPayments(): Promise<ArPayment[]> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { payments: ArPayment[] }).payments;
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const [invoices, payments] = await Promise.all([fetchInvoices(), fetchPayments()]);

  // Group invoices + payments by job.
  const jobIds = Array.from(new Set(invoices.map((i) => i.jobId)));
  // Allow ?completionNotice.<jobId>=YYYY-MM-DD to feed §7107 calc per job
  // until we have a completion-notice record type.
  const rows: JobRetentionStatus[] = jobIds
    .map((jobId) => {
      const jobInvoices = invoices.filter((i) => i.jobId === jobId);
      const jobPayments = payments.filter((p) => p.jobId === jobId);
      const customerName = jobInvoices[0]?.customerName ?? '(unknown)';
      const completionKey = `completionNotice.${jobId}`;
      const completionNoticeDate = searchParams[completionKey];
      return buildJobRetentionStatus({
        jobId,
        customerName,
        invoices: jobInvoices,
        payments: jobPayments,
        completionNoticeDate:
          completionNoticeDate && /^\d{4}-\d{2}-\d{2}$/.test(completionNoticeDate)
            ? completionNoticeDate
            : undefined,
      });
    })
    .filter(
      (r) => r.totalRetentionHeldCents > 0 || r.totalRetentionReleasedCents > 0,
    );

  const rollup = computeRetentionRollup(rows);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Retention</h1>
      <p className="mt-2 text-gray-700">
        Money still being held by customers. Past-due §7107 (60-day) clock
        triggers statutory 2%/month prompt-pay interest.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Jobs with retention" value={rollup.jobsWithRetention} />
        <Stat label="Total held" value={formatUSD(rollup.totalHeldCents)} />
        <Stat
          label="Outstanding"
          value={formatUSD(rollup.totalOutstandingCents)}
          variant={rollup.totalOutstandingCents > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Past-due interest"
          value={formatUSD(rollup.totalAccruedInterestCents)}
          variant={rollup.pastDueJobCount > 0 ? 'bad' : 'ok'}
        />
      </section>

      {rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No retention activity yet. Add a retention amount on an AR invoice to
          see it here.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2 text-right">Held</th>
                <th className="px-4 py-2 text-right">Released</th>
                <th className="px-4 py-2 text-right">Outstanding</th>
                <th className="px-4 py-2">Last invoice</th>
                <th className="px-4 py-2">§7107</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const overdue = r.ca7107 && r.ca7107.daysLate > 0;
                return (
                  <tr key={r.jobId} className={overdue ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      <Link href={`/jobs/${r.jobId}`} className="text-yge-blue-500 hover:underline">
                        {r.jobId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.customerName}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(r.totalRetentionHeldCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(r.totalRetentionReleasedCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                      {formatUSD(r.outstandingRetentionCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {r.lastInvoiceDate ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.ca7107 ? (
                        overdue ? (
                          <span className="font-semibold text-red-700">
                            {r.ca7107.daysLate}d late · {formatUSD(r.ca7107.interestCents)} interest
                          </span>
                        ) : (
                          <span className="text-green-700">
                            On time · due {r.ca7107.dueOn}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">No completion date</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Tip: until job records carry a completion-notice date, append{' '}
        <code className="rounded bg-gray-100 px-1">?completionNotice.{'{'}jobId{'}'}=YYYY-MM-DD</code>{' '}
        to the URL to project §7107 interest for a single job.
      </p>
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
