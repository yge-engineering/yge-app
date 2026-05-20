// /aging — AR + AP aging dashboard.
//
// Plain English: who owes us money, who we owe money to, bucketed
// 0-30 / 31-60 / 61-90 / 90+. Worst offenders at the top. Defaults
// to today; accepts ?asOf=yyyy-mm-dd so month-end snapshots match
// what the bookkeeper sees in close. The 90+ column is the danger
// bucket — that's real money in trouble.

import {
  AppShell,
  EmptyState,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { PrintButton } from '../../components/print-button';
import {
  AGING_BUCKETS,
  buildApAgingReport,
  buildArAgingReport,
  type AgingBucket,
  type AgingReport,
  type ApInvoice,
  type ArInvoice,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

export default async function AgingPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const asOf =
    searchParams.asOf?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
    new Date().toISOString().slice(0, 10);

  const [arInvoices, apInvoices] = await Promise.all([
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
  ]);

  const ar = buildArAgingReport({ asOf, arInvoices });
  const ap = buildApAgingReport({ asOf, apInvoices });
  const netCents = ar.totalOpenCents - ap.totalOpenCents;
  const t = getTranslator();

  const agHeaders = ['Party', 'Invoices', '0-30', '31-60', '61-90', '90+', 'Total open', 'Oldest (days)'];
  const dd = (c: number) => (c / 100).toFixed(2);
  const agRows = (rep: AgingReport): Array<Array<string | number>> =>
    rep.byParty.map((pp) => [
      pp.partyName,
      pp.invoiceCount,
      dd(pp.bucket0to30Cents),
      dd(pp.bucket31to60Cents),
      dd(pp.bucket61to90Cents),
      dd(pp.bucket90PlusCents),
      dd(pp.totalOpenCents),
      pp.oldestDaysOverdue,
    ]);
  const arCsvRows = agRows(ar);
  const apCsvRows = agRows(ap);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title={t('aging.title')}
          subtitle={t('aging.subtitle', { asOf })}
        />

        <form action="/aging" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3 print:hidden">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('aging.asOfDate')}</span>
            <input
              name="asOf"
              type="date"
              defaultValue={asOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            {t('aging.reload')}
          </button>
        </form>

        <div className="mb-4 flex justify-end print:hidden">
          <PrintButton />
        </div>

        {/* Summary cards — net AR-AP exposure at a glance. */}
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile
            label={t('aging.tile.openAr')}
            value={<Money cents={ar.totalOpenCents} />}
            sublabel={t('aging.tile.invoiceSub', { count: ar.rows.length, plural: ar.rows.length === 1 ? '' : 's' })}
            tone={ar.hasDangerBucket ? 'danger' : 'success'}
            warnText={ar.hasDangerBucket ? t('aging.tile.dangerWarn') : undefined}
          />
          <Tile
            label={t('aging.tile.openAp')}
            value={<Money cents={ap.totalOpenCents} />}
            sublabel={t('aging.tile.billSub', { count: ap.rows.length, plural: ap.rows.length === 1 ? '' : 's' })}
            tone={ap.hasDangerBucket ? 'danger' : 'success'}
            warnText={ap.hasDangerBucket ? t('aging.tile.dangerWarn') : undefined}
          />
          <Tile
            label={t('aging.tile.netWorking')}
            value={<Money cents={netCents} />}
            sublabel={t('aging.tile.netSub')}
            tone={netCents < 0 ? 'danger' : 'success'}
          />
        </section>

        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <a href="#ar" className="text-blue-700 hover:underline">{t('aging.jump.ar')}</a>
          <a href="#ap" className="text-blue-700 hover:underline">{t('aging.jump.ap')}</a>
        </div>

        <section id="ar" className="scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900">{t('aging.ar.heading')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('aging.ar.body')}</p>
          <div className="mt-2 flex justify-end print:hidden">
            <StatementCsvButton filename={`ar-aging_${asOf}.csv`} headers={agHeaders} rows={arCsvRows} />
          </div>
          <PartyTable side="AR" report={ar} partyHeader={t('aging.col.customer')} empty={t('aging.empty.ar')} t={t} />
        </section>

        <section id="ap" className="mt-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900">{t('aging.ap.heading')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('aging.ap.body')}</p>
          <div className="mt-2 flex justify-end print:hidden">
            <StatementCsvButton filename={`ap-aging_${asOf}.csv`} headers={agHeaders} rows={apCsvRows} />
          </div>
          <PartyTable side="AP" report={ap} partyHeader={t('aging.col.vendor')} empty={t('aging.empty.ap')} t={t} />
        </section>
      </main>
    </AppShell>
  );
}

function PartyTable({
  report,
  partyHeader,
  empty,
  t,
  side,
}: {
  report: AgingReport;
  partyHeader: string;
  empty: string;
  t: Translator;
  side: 'AR' | 'AP';
}) {
  if (report.byParty.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState title={empty} compact />
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">{partyHeader}</th>
            <th className="px-3 py-2 text-right">{t('aging.col.invCount')}</th>
            {AGING_BUCKETS.map((b) => (
              <th key={b} className="px-3 py-2 text-right">{t('aging.col.bucket', { bucket: b })}</th>
            ))}
            <th className="px-3 py-2 text-right">{t('aging.col.totalOpen')}</th>
            <th className="px-3 py-2 text-right">{t('aging.col.oldest')}</th>
            {side === 'AR' ? (
              <th className="px-3 py-2 text-right">Action</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {report.byParty.map((p) => (
            <tr
              key={p.partyName}
              className={p.bucket90PlusCents > 0 ? 'bg-red-50' : ''}
            >
              <td className="px-3 py-2 font-medium text-gray-900">{p.partyName}</td>
              <td className="px-3 py-2 text-right font-mono">{p.invoiceCount}</td>
              <td className="px-3 py-2 text-right">
                {p.bucket0to30Cents > 0 ? <Money cents={p.bucket0to30Cents} /> : <span className="font-mono text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2 text-right">
                {p.bucket31to60Cents > 0 ? <Money cents={p.bucket31to60Cents} /> : <span className="font-mono text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2 text-right">
                {p.bucket61to90Cents > 0 ? <Money cents={p.bucket61to90Cents} /> : <span className="font-mono text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2 text-right">
                {p.bucket90PlusCents > 0 ? (
                  <Money cents={p.bucket90PlusCents} className="font-bold text-red-700" />
                ) : (
                  <span className="font-mono text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Money cents={p.totalOpenCents} className="font-semibold" />
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-xs ${
                  p.oldestDaysOverdue > 90 ? 'font-bold text-red-700' : p.oldestDaysOverdue > 60 ? 'text-amber-700' : 'text-gray-600'
                }`}
              >
                {p.oldestDaysOverdue > 0 ? `${p.oldestDaysOverdue}d` : t('aging.current')}
              </td>
              {side === 'AR' && p.oldestDaysOverdue > 0 ? (
                <td className="px-3 py-2 text-right">
                  <ArReminderLink party={p} rowsForParty={report.rows.filter((r) => r.partyName === p.partyName)} asOf={report.asOf} />
                </td>
              ) : side === 'AR' ? (
                <td className="px-3 py-2 text-right"></td>
              ) : null}
            </tr>
          ))}
          <tr className="border-t-2 border-black bg-gray-50 font-semibold">
            <td className="px-3 py-3 uppercase tracking-wide">{t('aging.totals')}</td>
            <td className="px-3 py-3 text-right font-mono">{report.rows.length}</td>
            {AGING_BUCKETS.map((b) => (
              <td key={b} className="px-3 py-3 text-right">
                {report.bucketTotals[b] > 0 ? <Money cents={report.bucketTotals[b]} /> : <span className="font-mono text-gray-400">—</span>}
              </td>
            ))}
            <td className="px-3 py-3 text-right">
              <Money cents={report.totalOpenCents} />
            </td>
            <td></td>
          {side === 'AR' ? <td className="px-3 py-3"></td> : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// `AgingBucket` import kept for future strict-mode tightening of the
// PartyTable column iterator.

function ArReminderLink({
  party,
  rowsForParty,
  asOf,
}: {
  party: { partyName: string; totalOpenCents: number; oldestDaysOverdue: number };
  rowsForParty: AgingReport['rows'];
  asOf: string;
}) {
  const lines: string[] = [];
  for (const r of rowsForParty) {
    const dollars = (r.openCents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const overdue = r.daysOverdue > 0 ? ` — ${r.daysOverdue}d past due` : '';
    lines.push(`  #${r.invoiceNumber} (dated ${r.invoiceDate}): $${dollars}${overdue}`);
  }
  const totalDollars = (party.totalOpenCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const body = [
    `Hi ${party.partyName} team,`,
    '',
    `This is a friendly reminder on the following past-due invoices as of ${asOf}:`,
    '',
    ...lines,
    '',
    `Total open: $${totalDollars}.`,
    '',
    'Could you confirm the payment status when you get a chance? If you\'ve already cut a check, please share the check # so we can mark it received on our side.',
    '',
    'Thanks,',
    'Young General Engineering',
    'office@youngge.com · 707-499-7065',
  ].join('\n');
  const subject = `Past-due invoice reminder — ${party.partyName} (${asOf})`;
  const mailto =
    'mailto:?subject=' +
    encodeURIComponent(subject) +
    '&body=' +
    encodeURIComponent(body);
  return (
    <a
      href={mailto}
      className="rounded border border-yge-blue-300 bg-yge-blue-50 px-2 py-1 text-[11px] font-semibold text-yge-blue-700 hover:bg-yge-blue-100"
    >
      📧 Reminder
    </a>
  );
}

export type { AgingBucket };
