// /income-statement — period-bounded P&L from posted journal entries.
//
// Plain English: profit & loss for the period. Revenue − COGS = Gross
// Profit, less overhead, plus other income, less other expense = Net
// Income. Built from POSTED journal entries (drafts don't count).
//
// Optional ?compare=prior-period|prior-year adds a comparison column: we
// rebuild the same statement for the comparison window and show the headline
// totals side by side with dollar + percent variance.

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';
import Link from 'next/link';
import { PrintButton } from '../../components/print-button';
import { StatementCsvButton } from '../../components/statement-csv-button';
import {
  buildIncomeStatement,
  comparisonPeriod,
  grossProfitMargin,
  netProfitMargin,
  varianceCents,
  variancePct,
  type Account,
  type ComparisonMode,
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
  searchParams: { start?: string; end?: string; compare?: string };
}) {
  requirePermission('financials:view');
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

  const compareRaw = searchParams.compare ?? '';
  const compareMode: ComparisonMode | null =
    compareRaw === 'prior-year'
      ? 'PRIOR_YEAR'
      : compareRaw === 'prior-period'
        ? 'PRIOR_PERIOD'
        : null;
  const cmp = compareMode ? comparisonPeriod(periodStart, periodEnd, compareMode) : null;
  const stmtPrior = cmp
    ? buildIncomeStatement({ accounts, entries, periodStart: cmp.start, periodEnd: cmp.end })
    : null;
  const qs = `start=${periodStart}&end=${periodEnd}`;

  const csvHeaders = ['Section', 'Account #', 'Account', 'Amount'];
  const csvRows: Array<Array<string | number>> = [];
  const d = (cents: number) => (cents / 100).toFixed(2);
  const pushSection = (lbl: string, sec: IncomeStatementSection) => {
    for (const ln of sec.lines) csvRows.push([lbl, ln.accountNumber, ln.accountName, d(ln.amountCents)]);
  };
  pushSection('Revenue', stmt.revenue);
  csvRows.push(['', '', 'Total revenue', d(stmt.revenue.totalCents)]);
  pushSection('COGS', stmt.cogs);
  csvRows.push(['', '', 'Total COGS', d(stmt.cogs.totalCents)]);
  csvRows.push(['', '', 'Gross profit', d(stmt.grossProfitCents)]);
  pushSection('Overhead', stmt.overhead);
  csvRows.push(['', '', 'Total overhead', d(stmt.overhead.totalCents)]);
  csvRows.push(['', '', 'Operating income', d(stmt.operatingIncomeCents)]);
  pushSection('Other income', stmt.otherIncome);
  pushSection('Other expense', stmt.otherExpense);
  csvRows.push(['', '', 'Net income', d(stmt.netIncomeCents)]);

  const curSections = [stmt.revenue, stmt.cogs, stmt.overhead, stmt.otherIncome, stmt.otherExpense];
  const priorSections = stmtPrior
    ? [stmtPrior.revenue, stmtPrior.cogs, stmtPrior.overhead, stmtPrior.otherIncome, stmtPrior.otherExpense]
    : [];
  const lineCmp = new Map<string, { name: string; cur: number; prior: number }>();
  for (const sec of curSections)
    for (const ln of sec.lines) {
      const e = lineCmp.get(ln.accountNumber) ?? { name: ln.accountName, cur: 0, prior: 0 };
      e.cur += ln.amountCents;
      lineCmp.set(ln.accountNumber, e);
    }
  for (const sec of priorSections)
    for (const ln of sec.lines) {
      const e = lineCmp.get(ln.accountNumber) ?? { name: ln.accountName, cur: 0, prior: 0 };
      e.prior += ln.amountCents;
      lineCmp.set(ln.accountNumber, e);
    }
  const lineCmpRows = Array.from(lineCmp.entries())
    .map(([num, v]) => ({ num, name: v.name, cur: v.cur, prior: v.prior }))
    .sort((a, b) => a.num.localeCompare(b.num));

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

        <form action="/income-statement" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3 print:hidden">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('is.periodStart')}</span>
            <input type="date" name="start" defaultValue={periodStart} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('is.periodEnd')}</span>
            <input type="date" name="end" defaultValue={periodEnd} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <input type="hidden" name="compare" value={compareRaw} />
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            {t('is.recalculate')}
          </button>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Compare:</span>
            {([['', 'None'], ['prior-period', 'Prior period'], ['prior-year', 'Prior year']] as const).map(
              ([val, lbl]) => (
                <a
                  key={val || 'none'}
                  href={`/income-statement?${qs}${val ? `&compare=${val}` : ''}`}
                  className={`rounded px-2 py-1 font-medium ${
                    compareRaw === val
                      ? 'bg-blue-700 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {lbl}
                </a>
              ),
            )}
          </div>
        </form>

        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <PrintButton />
          <StatementCsvButton
            filename={`income-statement_${periodStart}_${periodEnd}.csv`}
            headers={csvHeaders}
            rows={csvRows}
          />
        </div>

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

        {stmtPrior && cmp && (
          <ComparisonCard
            label={compareMode === 'PRIOR_YEAR' ? 'Prior year' : 'Prior period'}
            priorRange={`${cmp.start} → ${cmp.end}`}
            rows={[
              ['Revenue', stmt.revenue.totalCents, stmtPrior.revenue.totalCents],
              ['COGS', stmt.cogs.totalCents, stmtPrior.cogs.totalCents],
              ['Gross profit', stmt.grossProfitCents, stmtPrior.grossProfitCents],
              ['Overhead', stmt.overhead.totalCents, stmtPrior.overhead.totalCents],
              ['Operating income', stmt.operatingIncomeCents, stmtPrior.operatingIncomeCents],
              ['Net income', stmt.netIncomeCents, stmtPrior.netIncomeCents],
            ]}
          />
        )}

        {stmtPrior && lineCmpRows.length > 0 && (
          <section className="mb-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Account-level comparison</h2>
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1">#</th>
                  <th className="py-1">Account</th>
                  <th className="py-1 text-right">This period</th>
                  <th className="py-1 text-right">Comparison</th>
                  <th className="py-1 text-right">Δ $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineCmpRows.map((r) => (
                  <tr key={r.num}>
                    <td className="py-1 font-mono">{r.num}</td>
                    <td className="py-1">{r.name}</td>
                    <td className="py-1 text-right font-mono"><Money cents={r.cur} /></td>
                    <td className="py-1 text-right font-mono text-gray-500"><Money cents={r.prior} /></td>
                    <td className={`py-1 text-right font-mono ${r.cur - r.prior < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                      <Money cents={r.cur - r.prior} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

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

function ComparisonCard({
  label,
  priorRange,
  rows,
}: {
  label: string;
  priorRange: string;
  rows: Array<[string, number, number]>;
}) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Period comparison</h2>
        <span className="text-xs text-gray-500">{label}: {priorRange}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          <tr className="border-b border-gray-200">
            <th className="py-1 text-left">Line</th>
            <th className="py-1 text-right">This period</th>
            <th className="py-1 text-right">{label}</th>
            <th className="py-1 text-right">Δ $</th>
            <th className="py-1 text-right">Δ %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(([name, cur, prior]) => {
            const dv = varianceCents(cur, prior);
            const dp = variancePct(cur, prior);
            return (
              <tr key={name}>
                <td className="py-1">{name}</td>
                <td className="py-1 text-right font-mono"><Money cents={cur} /></td>
                <td className="py-1 text-right font-mono text-gray-500"><Money cents={prior} /></td>
                <td className={`py-1 text-right font-mono ${dv < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  <Money cents={dv} />
                </td>
                <td className={`py-1 text-right font-mono ${dp !== null && dp < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  {dp === null ? '—' : `${dp >= 0 ? '+' : ''}${(dp * 100).toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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
              <td className="w-20 px-2 py-1 font-mono text-xs text-gray-600">
                <Link href={`/journal-entries/by-account?account=${ln.accountNumber}`} className="text-yge-blue-600 hover:underline" title="See the transactions behind this line">
                  {ln.accountNumber}
                </Link>
              </td>
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
