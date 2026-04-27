// Balance sheet — point-in-time financial position.
//
//   Assets (1xxxx)         =   Liabilities (2xxxx) + Equity (3xxxx)
//                              + Retained earnings (current-period
//                                net income flowing through)
//
// Pure derivation from the chart of accounts + posted journal entries
// dated on or before `asOf`. Sign convention:
//   - Assets are debit-natural — balance = debits − credits (positive
//     when there's money/value on the books)
//   - Liabilities + equity are credit-natural — balance = credits − debits
//
// Net income (revenue − COGS − overhead − other expense + other income)
// is computed inline and added to equity as "current period earnings".
// At a true year-end close, an actual journal entry would move that
// number into retained earnings; until then we show it as a separate
// line so the books square.

import type { Account, AccountType } from './coa';
import type { JournalEntry } from './journal-entry';

export interface BalanceSheetLine {
  accountNumber: string;
  accountName: string;
  type: AccountType;
  /** Cumulative balance as of asOf, signed to print positive on the
   *  side of the equation it belongs to. */
  amountCents: number;
}

export interface BalanceSheetSection {
  label: string;
  type: AccountType;
  lines: BalanceSheetLine[];
  totalCents: number;
}

export interface BalanceSheet {
  asOf: string;

  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;

  /** Net income from inception through asOf, surfaced as a line under
   *  equity. */
  currentPeriodEarningsCents: number;

  /** Total liabilities + equity + current period earnings. */
  totalLiabilitiesAndEquityCents: number;

  /** Equality check — assets minus (liab + equity + retained). 0 means
   *  the books square. */
  imbalanceCents: number;
  /** True when imbalanceCents == 0. */
  inBalance: boolean;
}

interface ActivityRow {
  debitCents: number;
  creditCents: number;
}

function aggregateActivity(
  entries: JournalEntry[],
  asOf: string,
): Map<string, ActivityRow> {
  const map = new Map<string, ActivityRow>();
  for (const je of entries) {
    if (je.status !== 'POSTED') continue;
    if (je.entryDate > asOf) continue;
    for (const line of je.lines) {
      const cur = map.get(line.accountNumber) ?? {
        debitCents: 0,
        creditCents: 0,
      };
      cur.debitCents += line.debitCents;
      cur.creditCents += line.creditCents;
      map.set(line.accountNumber, cur);
    }
  }
  return map;
}

/** Build the balance sheet as of `asOf` (yyyy-mm-dd, inclusive). */
export function buildBalanceSheet(args: {
  accounts: Account[];
  entries: JournalEntry[];
  asOf: string;
}): BalanceSheet {
  const { accounts, entries, asOf } = args;
  const activity = aggregateActivity(entries, asOf);

  function lineFor(
    a: Account,
    side: 'DEBIT' | 'CREDIT',
  ): BalanceSheetLine | null {
    const act = activity.get(a.number);
    if (!act) return null;
    const amount =
      side === 'DEBIT'
        ? act.debitCents - act.creditCents
        : act.creditCents - act.debitCents;
    if (amount === 0) return null;
    return {
      accountNumber: a.number,
      accountName: a.name,
      type: a.type,
      amountCents: amount,
    };
  }

  function buildSection(
    label: string,
    type: AccountType,
    side: 'DEBIT' | 'CREDIT',
  ): BalanceSheetSection {
    const lines: BalanceSheetLine[] = [];
    for (const a of accounts) {
      if (a.type !== type) continue;
      const ln = lineFor(a, side);
      if (ln) lines.push(ln);
    }
    lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    const totalCents = lines.reduce((sum, ln) => sum + ln.amountCents, 0);
    return { label, type, lines, totalCents };
  }

  const assets = buildSection('Assets', 'ASSET', 'DEBIT');
  const liabilities = buildSection('Liabilities', 'LIABILITY', 'CREDIT');
  const equity = buildSection('Equity', 'EQUITY', 'CREDIT');

  // Current period earnings = revenue + other income − COGS − overhead −
  // other expense, summed across every posted entry through asOf. Any
  // accountNumber starting with 4/5/6/7/8 contributes via the COA's type.
  let revenueCents = 0;
  let cogsCents = 0;
  let overheadCents = 0;
  let otherIncomeCents = 0;
  let otherExpenseCents = 0;
  const accountByNum = new Map(accounts.map((a) => [a.number, a]));
  for (const [num, act] of activity) {
    const a = accountByNum.get(num);
    if (!a) continue;
    switch (a.type) {
      case 'REVENUE':
        revenueCents += act.creditCents - act.debitCents;
        break;
      case 'COGS':
        cogsCents += act.debitCents - act.creditCents;
        break;
      case 'EXPENSE':
        overheadCents += act.debitCents - act.creditCents;
        break;
      case 'OTHER_INCOME':
        otherIncomeCents += act.creditCents - act.debitCents;
        break;
      case 'OTHER_EXPENSE':
        otherExpenseCents += act.debitCents - act.creditCents;
        break;
      default:
        break;
    }
  }
  const currentPeriodEarningsCents =
    revenueCents - cogsCents - overheadCents + otherIncomeCents - otherExpenseCents;

  const totalLiabilitiesAndEquityCents =
    liabilities.totalCents + equity.totalCents + currentPeriodEarningsCents;

  const imbalanceCents = assets.totalCents - totalLiabilitiesAndEquityCents;

  return {
    asOf,
    assets,
    liabilities,
    equity,
    currentPeriodEarningsCents,
    totalLiabilitiesAndEquityCents,
    imbalanceCents,
    inBalance: imbalanceCents === 0,
  };
}
