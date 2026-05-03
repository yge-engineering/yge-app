// /income-statement — period-bounded P&L from posted journal entries.
//
// Plain English: profit & loss for the period. Revenue − COGS = Gross
// Profit, less overhead, plus other income, less other expense = Net
// Income. Built from POSTED journal entries (drafts don't count).

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import {
  buildIncomeStatement,
  grossProfitMargin,
  netProfitMargin,
  type Account,
  type IncomeStatementSection,
  type JournalEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAccounts(): Promise<Account[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { accounts: Account[] }).accounts;
  } catch { return []; }
}
async function fetchEntries(): Promise<JournalEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: JournalEntry[] }).entries;
  } catch { return []; }
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const def = defaultPeriod();
  const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.start ?? '')
    ? (searchParams.start as string)
    : def.start;
  const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.end ?? '')
    ? (searchParams.end as string)
    : def.end;

  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const stmt = buildIncomeStatement({ accounts, entries, periodStart, periodEnd });
  const gpm = grossProfitMargin(stmt);
  const npm = netProfitMargin(stmt);
  const t = getTranslator();

  // Section heading lookup keyed by section.type so localized strings replace
  // the hard-coded English labels baked into buildIncomeStatement.
  function sectionLabel(s: IncomeStatementSection): string {
    if (s.type === 'REVENUE') return t('is.section.revenue');
    if (s.type === 'COGS') return t('is.section.cogs');
    if (s.type === 'EXPENSE') return t('is.section.overhead');
    if (s.type === 'OTHER_INCOME') return t('is.section.otherIncome');
    if (s.type === 'OTHER_EXPENSE') return t('is.section.otherExpense');
    return s.label;
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={t('is.title')}
          subtitle={t('is.subtitle')}
        />

        <form action="/income-statement" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('is.periodStart')}</span>
            <input type="date" name="start" defaultValue={periodStart} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('is.periodEnd')}</span>
            <input type="date" name="end" defaultValue={periodEnd} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            {t('is.recalculate')}
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('is.tile.revenue')} value={<Money cents={stmt.revenue.totalCents} />} />
          <Tile label={t('is.tile.grossProfit')} value={<Money cents={stmt.grossProfitCents} />} />
          <Tile
            label={t('is.tile.netIncome')}
            value={<Money cents={stmt.netIncomeCents} />}
            tone={stmt.netIncomeCents < 0 ? 'danger' : 'success'}
          />
          <Tile label={t('is.tile.margins')} value={`${(gpm * 100).toFixed(1)}% / ${(npm * 100).toFixed(1)}%`} />
        </section>

        <article className="rounded-md border border-gray-200 bg-white p-6">
          <header className="border-b border-gray-300 pb-2 text-center">
            <h2 className="text-lg font-bold uppercase">{t('is.companyHeading')}</h2>
            <p className="text-sm">{t('is.docTitle')}</p>
            <p className="text-xs text-gray-600">{t('is.periodLine', { start: stmt.periodStart, end: stmt.periodEnd })}</p>
          </header>

          <SectionTable section={stmt.revenue} label={sectionLabel(stmt.revenue)} t={t} />
          <SubtotalRow label={t('is.totalRevenue')} cents={stmt.revenue.totalCents} />

          <SectionTable section={stmt.cogs} label={sectionLabel(stmt.cogs)} t={t} />
          <SubtotalRow label={t('is.totalCogs')} cents={stmt.cogs.totalCents} />

          <BoldRow label={t('is.grossProfit')} cents={stmt.grossProfitCents} />

          <SectionTable section={stmt.overhead} label={sectionLabel(stmt.overhead)} t={t} />
          <SubtotalRow label={t('is.totalOverhead')} cents={stmt.overhead.totalCents} />

          <BoldRow label={t('is.operatingIncome')} cents={stmt.operatingIncomeCents} />

          <SectionTable section={stmt.otherIncome} label={sectionLabel(stmt.otherIncome)} t={t} />
          <SubtotalRow label={t('is.totalOtherIncome')} cents={stmt.otherIncome.totalCents} />

          <SectionTable section={stmt.otherExpense} label={sectionLabel(stmt.otherExpense)} t={t} />
          <SubtotalRow label={t('is.totalOtherExpense')} cents={stmt.otherExpense.totalCents} />

          <BoldRow label={t('is.netIncome')} cents={stmt.netIncomeCents} highlight />
        </article>
      </main>
    </AppShell>
  );
}

function SectionTable({ section, label, t }: { section: IncomeStatementSection; label: string; t: Translator }) {
  if (section.lines.length === 0) {
    return (
      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
        <p className="mt-1 text-xs text-gray-400">{t('is.noActivity')}</p>
      </section>
    );
  }
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {section.lines.map((ln) => (
            <tr key={ln.accountNumber} className="border-b border-gray-100">
              <td className="w-20 px-2 py-1 font-mono text-xs text-gray-600">{ln.accountNumber}</td>
              <td className="px-2 py-1">{ln.accountName}</td>
              <td className="px-2 py-1 text-right">
                <Money cents={ln.amountCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SubtotalRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="mt-1 flex items-center justify-between border-b-2 border-gray-300 px-2 py-1 text-sm font-semibold">
      <span>{label}</span>
      <Money cents={cents} />
    </div>
  );
}

function BoldRow({
  label,
  cents,
  highlight = false,
}: {
  label: string;
  cents: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mt-3 flex items-center justify-between rounded px-2 py-2 text-sm font-bold ${
        highlight
          ? cents < 0
            ? 'border-2 border-red-400 bg-red-50 text-red-900'
            : 'border-2 border-emerald-400 bg-emerald-50 text-emerald-900'
          : 'border-y-2 border-black'
      }`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <Money cents={cents} className="text-base" />
    </div>
  );
}
