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

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title={t('aging.title')}
          subtitle={t('aging.subtitle', { asOf })}
        />

        <form action="/aging" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
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
          <PartyTable report={ar} partyHeader={t('aging.col.customer')} empty={t('aging.empty.ar')} t={t} />
        </section>

        <section id="ap" className="mt-12 scroll-mt-8">
          <h2 className="text-xl font-bold text-gray-900">{t('aging.ap.heading')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('aging.ap.body')}</p>
          <PartyTable report={ap} partyHeader={t('aging.col.vendor')} empty={t('aging.empty.ap')} t={t} />
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
}: {
  report: AgingReport;
  partyHeader: string;
  empty: string;
  t: Translator;
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
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// `AgingBucket` import kept for future strict-mode tightening of the
// PartyTable column iterator.
export type { AgingBucket };
