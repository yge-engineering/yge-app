// /balance-sheet — point-in-time financial position from posted JEs.
//
// Plain English: Assets = Liabilities + Equity + current-period
// earnings. Built from POSTED journal entries through the as-of date.
// The in-balance check at the top is the bookkeeper's first sanity
// step before printing the statement.
//
// Optional ?vsAsOf=yyyy-mm-dd adds a comparison column as of an earlier
// date (a "Prior year" toggle fills it from the current as-of). We rebuild
// the sheet as of that date and show headline totals with $ + % variance.

import {
  Alert,
  AppShell,
  LinkButton,
  Money,
  PageHeader,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import { requirePermission } from '../../lib/permissions';
import { StatementCsvButton } from '../../components/statement-csv-button';
import {
  buildBalanceSheet,
  priorYearDate,
  varianceCents,
  variancePct,
  type Account,
  type BalanceSheetSection,
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

function equityTotal(sheet: ReturnType<typeof buildBalanceSheet>): number {
  return sheet.equity.totalCents + sheet.currentPeriodEarningsCents;
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { asOf?: string; vsAsOf?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.asOf ?? '')
    ? (searchParams.asOf as string)
    : today;
  const vsAsOf = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.vsAsOf ?? '')
    ? (searchParams.vsAsOf as string)
    : '';

  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const sheet = buildBalanceSheet({ accounts, entries, asOf });
  const sheetPrior = vsAsOf ? buildBalanceSheet({ accounts, entries, asOf: vsAsOf }) : null;
  const t = getTranslator();

  // Section heading: prefer the locale-aware label keyed by section.type, fall
  // back to the helper-provided label if the type is somehow unmapped.
  function sectionLabel(s: BalanceSheetSection): string {
    if (s.type === 'ASSET') return t('bs.section.assets');
    if (s.type === 'LIABILITY') return t('bs.section.liabilities');
    if (s.type === 'EQUITY') return t('bs.section.equity');
    return s.label;
  }

  // Equation banner pre-renders Money in the placeholders, so we keep it as a
  // JSX fragment with the split-and-fill pattern.
  const eqTpl = t('bs.equation', { assets: '__ASSETS__', liabEq: '__LIABEQ__' });
  const eqParts = eqTpl.split(/__ASSETS__|__LIABEQ__/);

  const csvHeaders = ['Section', 'Account #', 'Account', 'Amount'];
  const csvRows: Array<Array<string | number>> = [];
  const d = (cents: number) => (cents / 100).toFixed(2);
  const pushSection = (lbl: string, sec: BalanceSheetSection) => {
    for (const ln of sec.lines) csvRows.push([lbl, ln.accountNumber, ln.accountName, d(ln.amountCents)]);
  };
  pushSection('Assets', sheet.assets);
  csvRows.push(['', '', 'Total assets', d(sheet.assets.totalCents)]);
  pushSection('Liabilities', sheet.liabilities);
  csvRows.push(['', '', 'Total liabilities', d(sheet.liabilities.totalCents)]);
  pushSection('Equity', sheet.equity);
  csvRows.push(['', '', 'Current period earnings', d(sheet.currentPeriodEarningsCents)]);
  csvRows.push(['', '', 'Total equity', d(sheet.equity.totalCents + sheet.currentPeriodEarningsCents)]);
  csvRows.push(['', '', 'Total liabilities + equity', d(sheet.totalLiabilitiesAndEquityCents)]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title={t('bs.title')}
          subtitle={t('bs.subtitle')}
          actions={
            <LinkButton href="/income-statement" variant="secondary" size="md">
              {t('bs.plLink')}
            </LinkButton>
          }
        />

        <form action="/balance-sheet" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('bs.asOf')}</span>
            <input
              type="date"
              name="asOf"
              defaultValue={asOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Compare to (as of)</span>
            <input
              type="date"
              name="vsAsOf"
              defaultValue={vsAsOf}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            {t('bs.recalculate')}
          </button>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Quick:</span>
            <a
              href={`/balance-sheet?asOf=${asOf}`}
              className={`rounded px-2 py-1 font-medium ${vsAsOf === '' ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              None
            </a>
            <a
              href={`/balance-sheet?asOf=${asOf}&vsAsOf=${priorYearDate(asOf)}`}
              className={`rounded px-2 py-1 font-medium ${vsAsOf === priorYearDate(asOf) ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Prior year
            </a>
          </div>
        </form>

        <div className="mb-4 flex justify-end">
          <StatementCsvButton
            filename={`balance-sheet_${asOf}.csv`}
            headers={csvHeaders}
            rows={csvRows}
          />
        </div>

        <Alert
          tone={sheet.inBalance ? 'success' : 'danger'}
          title={sheet.inBalance ? t('bs.balanced') : t('bs.outOfBalance')}
          className="mb-4"
        >
          {eqParts[0]}<Money cents={sheet.assets.totalCents} />{eqParts[1]}<Money cents={sheet.totalLiabilitiesAndEquityCents} />{eqParts[2]}
          {!sheet.inBalance ? (() => {
            const imTpl = t('bs.imbalance', { imbalance: '__IM__' });
            const imParts = imTpl.split(/__IM__/);
            return <> {imParts[0]}<Money cents={sheet.imbalanceCents} />{imParts[1]}</>;
          })() : null}
        </Alert>

        {sheetPrior && (
          <section className="mb-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Comparison</h2>
              <span className="text-xs text-gray-500">as of {vsAsOf}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1 text-left">Line</th>
                  <th className="py-1 text-right">{asOf}</th>
                  <th className="py-1 text-right">{vsAsOf}</th>
                  <th className="py-1 text-right">Δ $</th>
                  <th className="py-1 text-right">Δ %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {([
                  ['Total assets', sheet.assets.totalCents, sheetPrior.assets.totalCents],
                  ['Total liabilities', sheet.liabilities.totalCents, sheetPrior.liabilities.totalCents],
                  ['Total equity', equityTotal(sheet), equityTotal(sheetPrior)],
                  ['Liabilities + equity', sheet.totalLiabilitiesAndEquityCents, sheetPrior.totalLiabilitiesAndEquityCents],
                ] as Array<[string, number, number]>).map(([name, cur, prior]) => {
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
        )}

        <article className="rounded-md border border-gray-200 bg-white p-6">
          <header className="border-b border-gray-300 pb-2 text-center">
            <h2 className="text-lg font-bold uppercase">{t('bs.companyHeading')}</h2>
            <p className="text-sm">{t('bs.docTitle')}</p>
            <p className="text-xs text-gray-600">{t('bs.asOfDate', { date: sheet.asOf })}</p>
          </header>

          <SectionTable section={sheet.assets} label={sectionLabel(sheet.assets)} t={t} />
          <SubtotalRow label={t('bs.totalAssets')} cents={sheet.assets.totalCents} highlight />

          <SectionTable section={sheet.liabilities} label={sectionLabel(sheet.liabilities)} t={t} />
          <SubtotalRow label={t('bs.totalLiabilities')} cents={sheet.liabilities.totalCents} />

          <SectionTable section={sheet.equity} label={sectionLabel(sheet.equity)} t={t} />
          <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1 text-sm italic">
            <span>{t('bs.currentPeriodEarnings')}</span>
            <Money cents={sheet.currentPeriodEarningsCents} />
          </div>
          <SubtotalRow
            label={t('bs.totalEquity')}
            cents={sheet.equity.totalCents + sheet.currentPeriodEarningsCents}
          />

          <SubtotalRow
            label={t('bs.totalLiabEq')}
            cents={sheet.totalLiabilitiesAndEquityCents}
            highlight
          />
        </article>
      </main>
    </AppShell>
  );
}

function SectionTable({ section, label, t }: { section: BalanceSheetSection; label: string; t: Translator }) {
  if (section.lines.length === 0) {
    return (
      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
        <p className="mt-1 text-xs text-gray-400">{t('bs.noActivity')}</p>
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

function SubtotalRow({
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
      className={`mt-1 flex items-center justify-between px-2 py-2 text-sm font-semibold ${
        highlight ? 'border-y-2 border-black' : 'border-b-2 border-gray-300'
      }`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <Money cents={cents} />
    </div>
  );
}
