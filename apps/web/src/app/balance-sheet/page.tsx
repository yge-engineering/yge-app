// /balance-sheet — point-in-time financial position from posted JEs.
//
// Plain English: Assets = Liabilities + Equity + current-period
// earnings. Built from POSTED journal entries through the as-of date.
// The in-balance check at the top is the bookkeeper's first sanity
// step before printing the statement.

import {
  Alert,
  AppShell,
  LinkButton,
  Money,
  PageHeader,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import {
  buildBalanceSheet,
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

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.asOf ?? '')
    ? (searchParams.asOf as string)
    : today;

  const [accounts, entries] = await Promise.all([fetchAccounts(), fetchEntries()]);
  const sheet = buildBalanceSheet({ accounts, entries, asOf });
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
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            {t('bs.recalculate')}
          </button>
        </form>

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
