// /ap-invoices — vendor bill list with rollup + status filters.
//
// Plain English: vendor bills. Manual entry for Phase 1; AI-scan from
// a PDF lands in a later phase that drops the same shape into the
// create endpoint. Overdue dollars at the top, dueSoon rows tinted,
// so AP knows which checks to cut next.

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
import { getLocale, getTranslator } from '../../lib/locale';
import {
  apDueLevel,
  apStatusLabel,
  computeApInvoiceRollup,
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
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchInvoices(filter: { status?: string; jobId?: string }): Promise<ApInvoice[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/ap-invoices`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchAllInvoices(): Promise<ApInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ApInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function statusTone(s: ApInvoiceStatus): 'success' | 'info' | 'warn' | 'danger' | 'neutral' {
  switch (s) {
    case 'PAID': return 'success';
    case 'APPROVED': return 'info';
    case 'PENDING': return 'warn';
    case 'REJECTED': return 'danger';
    default: return 'neutral';
  }
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

  const csvHref = `${publicApiBaseUrl()}/api/ap-invoices?format=csv${
    searchParams.status ? '&status=' + encodeURIComponent(searchParams.status) : ''
  }${searchParams.jobId ? '&jobId=' + encodeURIComponent(searchParams.jobId) : ''}`;
  const t = getTranslator();
  const locale = getLocale();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('ap.title')}
          subtitle={t('ap.subtitle')}
          actions={
            <span className="flex gap-2">
              <a
                href={csvHref}
                className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t('ap.downloadCsv')}
              </a>
              <LinkButton href="/ap-invoices/new" variant="primary" size="md">
                {t('ap.newInvoice')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile
            label={t('ap.tile.outstanding')}
            value={<Money cents={rollup.outstandingCents} />}
            sublabel={t('ap.tile.outstandingSub', { count: rollup.draft + rollup.pending + rollup.approved })}
            tone={rollup.outstandingCents > 0 ? 'warn' : 'neutral'}
          />
          <Tile
            label={t('ap.tile.overdue')}
            value={<Money cents={rollup.overdueCents} />}
            tone={rollup.overdueCents > 0 ? 'danger' : 'success'}
          />
          <Tile label={t('ap.tile.pending')} value={rollup.pending} />
          <Tile label={t('ap.tile.paid')} value={rollup.paid} tone="success" />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('ap.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('ap.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {apStatusLabel(s, locale)}
            </Link>
          ))}
        </section>

        {invoices.length === 0 ? (
          <EmptyState
            title={t('ap.empty.title')}
            body={t('ap.empty.body')}
            actions={[{ href: '/ap-invoices/new', label: t('ap.empty.action'), primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('ap.col.vendor')}</th>
                  <th className="px-4 py-2">{t('ap.col.invoiceNumber')}</th>
                  <th className="px-4 py-2">{t('ap.col.job')}</th>
                  <th className="px-4 py-2">{t('ap.col.date')}</th>
                  <th className="px-4 py-2">{t('ap.col.due')}</th>
                  <th className="px-4 py-2 text-right">{t('ap.col.total')}</th>
                  <th className="px-4 py-2 text-right">{t('ap.col.balance')}</th>
                  <th className="px-4 py-2">{t('ap.col.status')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const lvl = apDueLevel(inv);
                  const job = inv.jobId ? jobById.get(inv.jobId) : undefined;
                  const balance = unpaidBalanceCents(inv);
                  const rowClass = lvl === 'overdue' ? 'bg-red-50' : lvl === 'dueSoon' ? 'bg-amber-50' : '';
                  return (
                    <tr key={inv.id} className={rowClass}>
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.vendorName}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {inv.invoiceNumber ?? <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {job ? (
                          <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">{job.projectName}</Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceDate}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {inv.dueDate ?? <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><Money cents={inv.totalCents} /></td>
                      <td className="px-4 py-3 text-right">
                        {balance > 0 ? <Money cents={balance} className="font-semibold" /> : <span className="text-sm text-gray-400">paid</span>}
                      </td>
                      <td className="px-4 py-3"><StatusPill label={apStatusLabel(inv.status, locale)} tone={statusTone(inv.status)} /></td>
                      <td className="px-4 py-3 text-right text-sm">
                        <Link href={`/ap-invoices/${inv.id}`} className="text-blue-700 hover:underline">Open</Link>
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
