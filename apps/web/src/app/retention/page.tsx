// /retention — retention dashboard rolled up from AR invoices + payments.
//
// Plain English: money still being held by customers. The 60-day
// CA PCC §7107 clock starts at the notice of completion; once it's
// blown past, statutory 2%/month prompt-pay interest accrues — that
// number is too easy to leave on the table without a place to see it.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  Money,
  PageHeader,
  ProgressBar,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  buildJobRetentionStatus,
  computeRetentionRollup,
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
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch {
    return [];
  }
}

async function fetchPayments(): Promise<ArPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ArPayment[] }).payments;
  } catch {
    return [];
  }
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const [invoices, payments] = await Promise.all([fetchInvoices(), fetchPayments()]);

  // Group invoices + payments by job.
  const jobIds = Array.from(new Set(invoices.map((i) => i.jobId)));
  // Allow ?completionNotice.<jobId>=YYYY-MM-DD to feed §7107 calc per
  // job until we have a completion-notice record type.
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('retention.title')}
          subtitle={t('retention.subtitle')}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('retention.tile.jobsWithRetention')} value={rollup.jobsWithRetention} />
          <Tile label={t('retention.tile.totalHeld')} value={<Money cents={rollup.totalHeldCents} />} />
          <Tile
            label={t('retention.tile.outstanding')}
            value={<Money cents={rollup.totalOutstandingCents} />}
            tone={rollup.totalOutstandingCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label={t('retention.tile.pastDueInterest')}
            value={<Money cents={rollup.totalAccruedInterestCents} />}
            tone={rollup.pastDueJobCount > 0 ? 'danger' : 'success'}
            warnText={rollup.pastDueJobCount > 0 ? t('retention.tile.warn', { count: rollup.pastDueJobCount, plural: rollup.pastDueJobCount === 1 ? '' : 's' }) : undefined}
          />
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title={t('retention.empty.title')}
            body={t('retention.empty.body')}
            actions={[{ href: '/ar-invoices/new', label: t('retention.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={rows.map((r) => ({ ...r, id: r.jobId }))}
            keyFn={(r) => r.jobId}
            columns={[
              {
                key: 'job',
                header: t('retention.col.job'),
                cell: (r) => (
                  <Link href={`/jobs/${r.jobId}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {r.jobId}
                  </Link>
                ),
              },
              { key: 'customer', header: t('retention.col.customer'), cell: (r) => <span className="text-sm text-gray-900">{r.customerName}</span> },
              { key: 'held', header: t('retention.col.held'), numeric: true, cell: (r) => <Money cents={r.totalRetentionHeldCents} /> },
              {
                key: 'released',
                header: t('retention.col.released'),
                numeric: true,
                cell: (r) => (
                  <span className="inline-flex w-24 flex-col items-stretch align-middle">
                    <Money cents={r.totalRetentionReleasedCents} />
                    {r.totalRetentionHeldCents > 0 ? (
                      <ProgressBar
                        value={r.totalRetentionReleasedCents}
                        max={r.totalRetentionHeldCents}
                        tone={r.totalRetentionReleasedCents >= r.totalRetentionHeldCents ? 'success' : 'info'}
                        size="sm"
                        className="mt-0.5"
                      />
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'outstanding',
                header: t('retention.col.outstanding'),
                numeric: true,
                cell: (r) => <Money cents={r.outstandingRetentionCents} className="font-semibold" />,
              },
              {
                key: 'lastInvoice',
                header: t('retention.col.lastInvoice'),
                cell: (r) => <span className="text-xs text-gray-700">{r.lastInvoiceDate ?? '—'}</span>,
              },
              {
                key: 'ca7107',
                header: t('retention.col.ca7107'),
                cell: (r) => {
                  if (!r.ca7107) return <span className="text-xs text-gray-400">{t('retention.noCompletion')}</span>;
                  const overdue = r.ca7107.daysLate > 0;
                  if (overdue) {
                    // Split-and-fill: split the localized template on the
                    // {interest} sentinel so we can keep the inline <Money/>
                    // component for the interest value.
                    const tpl = t('retention.daysLate', { days: r.ca7107.daysLate, interest: '__INT__' });
                    const [pre, post] = tpl.split('__INT__');
                    return (
                      <span className="text-xs font-semibold text-red-700">
                        {pre}<Money cents={r.ca7107.interestCents} />{post}
                      </span>
                    );
                  }
                  return (
                    <span className="text-xs text-emerald-700">{t('retention.onTime', { date: r.ca7107.dueOn })}</span>
                  );
                },
              },
            ]}
          />
        )}

        <p className="mt-4 text-xs text-gray-500">{t('retention.tip')}</p>
      </main>
    </AppShell>
  );
}
