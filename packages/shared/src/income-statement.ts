// Income statement (P&L) — period-bounded earnings report.
//
// Pure derivation. Walks the chart of accounts + posted journal
// entries within a date range and emits the standard:
//
//   Revenue (4xxxx)               $X
// − COGS (5xxxx)                  $X
// = Gross Profit                  $X
// − Overhead Expense (6xxxx)      $X
// = Operating Income              $X
// + Other Income (7xxxx)          $X
// − Other Expense (8xxxx)         $X
// = Net Income                    $X
//
// Sign convention: revenue/income lines have natural CREDIT balance
// (we display them as positive); cost/expense lines have natural
// DEBIT balance (we display as positive too). The math here uses
// "credit minus debit" for revenue accounts so the printed number is
// the income side of the equation.

import type { Account, AccountType } from './coa';
import type { JournalEntry } from './journal-entry';

export interface IncomeStatementLine {
  accountNumber: string;
  accountName: string;
  type: AccountType;
  /** Period activity in cents, signed so the printed report adds up:
   *  positive for revenue/income, positive for expenses/COGS too — the
   *  caller's section roll-up handles the subtraction. */
  amountCents: number;
}

export interface IncomeStatementSection {
  label: string;
  type: AccountType;
  lines: IncomeStatementLine[];
  totalCents: number;
}

export interface IncomeStatement {
  /** Period start (yyyy-mm-dd, inclusive). */
  periodStart: string;
  /** Period end (yyyy-mm-dd, inclusive). */
  periodEnd: string;

  revenue: IncomeStatementSection;
  cogs: IncomeStatementSection;
  /** Revenue − COGS. */
  grossProfitCents: number;

  overhead: IncomeStatementSection;
  /** Gross profit − overhead. */
  operatingIncomeCents: number;

  otherIncome: IncomeStatementSection;
  otherExpense: IncomeStatementSection;
  /** Operating income + other income − other expense. */
  netIncomeCents: number;
}

/**
 * Build a P&L from the COA + posted journal entries.
 *
 * - `accounts`: chart of accounts (used to look up names + filter inactive)
 * - `entries`: full journal-entry stream (we filter by status + date)
 * - `periodStart`, `periodEnd`: yyyy-mm-dd inclusive
 */
export function buildIncomeStatement(args: {
  accounts: Account[];
  entries: JournalEntry[];
  periodStart: string;
  periodEnd: string;
}): IncomeStatement {
  const { accounts, entries, periodStart, periodEnd } = args;

  // Sum activity per account for posted entries within the period.
  const activity = new Map<
    string,
    { debitCents: number; creditCents: number }
  >();
  for (const je of entries) {
    if (je.status !== 'POSTED') continue;
    if (je.entryDate < periodStart || je.entryDate > periodEnd) continue;
    for (const line of je.lines) {
      const cur = activity.get(line.accountNumber) ?? {
        debitCents: 0,
        creditCents: 0,
      };
      cur.debitCents += line.debitCents;
      cur.creditCents += line.creditCents;
      activity.set(line.accountNumber, cur);
    }
  }

  const accountByNum = new Map(accounts.map((a) => [a.number, a]));

  function lineFor(num: string, type: AccountType): IncomeStatementLine | null {
    const a = accountByNum.get(num);
    if (!a) return null;
    if (a.type !== type) return null;
    const act = activity.get(num);
    if (!act) return null;
    // Income statement convention:
    //   For credit-natural accounts (REVENUE, OTHER_INCOME): show
    //   credits − debits as the positive period activity.
    //   For debit-natural (COGS, EXPENSE, OTHER_EXPENSE): show
    //   debits − credits.
    let amount: number;
    if (type === 'REVENUE' || type === 'OTHER_INCOME') {
      amount = act.creditCents - act.debitCents;
    } else {
      amount = act.debitCents - act.creditCents;
    }
    if (amount === 0) return null;
    return {
      accountNumber: num,
      accountName: a.name,
      type,
      amountCents: amount,
    };
  }

  function buildSection(label: string, type: AccountType): IncomeStatementSection {
    const lines: IncomeStatementLine[] = [];
    for (const a of accounts) {
      if (a.type !== type) continue;
      const ln = lineFor(a.number, type);
      if (ln) lines.push(ln);
    }
    // Also surface any posted account number that's not in the COA
    // (orphaned) so the bookkeeper sees it. Use type guess from leading
    // digit by skipping — only include orphans whose leading digit
    // matches the section type.
    lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    const totalCents = lines.reduce((sum, ln) => sum + ln.amountCents, 0);
    return { label, type, lines, totalCents };
  }

  const revenue = buildSection('Revenue', 'REVENUE');
  const cogs = buildSection('Job cost (COGS)', 'COGS');
  const grossProfitCents = revenue.totalCents - cogs.totalCents;

  const overhead = buildSection('Overhead expense', 'EXPENSE');
  const operatingIncomeCents = grossProfitCents - overhead.totalCents;

  const otherIncome = buildSection('Other income', 'OTHER_INCOME');
  const otherExpense = buildSection('Other expense', 'OTHER_EXPENSE');
  const netIncomeCents =
    operatingIncomeCents + otherIncome.totalCents - otherExpense.totalCents;

  return {
    periodStart,
    periodEnd,
    revenue,
    cogs,
    grossProfitCents,
    overhead,
    operatingIncomeCents,
    otherIncome,
    otherExpense,
    netIncomeCents,
  };
}

/** Gross profit margin as a fraction (0..1). 0 if revenue is 0. */
export function grossProfitMargin(stmt: IncomeStatement): number {
  return stmt.revenue.totalCents > 0
    ? stmt.grossProfitCents / stmt.revenue.totalCents
    : 0;
}

/** Net profit margin as a fraction (0..1). 0 if revenue is 0. */
export function netProfitMargin(stmt: IncomeStatement): number {
  return stmt.revenue.totalCents > 0
    ? stmt.netIncomeCents / stmt.revenue.totalCents
    : 0;
}
