// Portfolio journal entry activity by month.
//
// Plain English: per yyyy-mm of entryDate, count JE volume,
// status mix (DRAFT / POSTED / VOIDED), and the source-mix
// total. Drives the bookkeeper's monthly close review.
//
// Per row: month, total, posted, draft, voided, totalDebitCents,
// totalCreditCents, distinctSources, distinctAccounts.
//
// Sort: month asc.
//
// Different from journal-entry-monthly (no source/account
// distinct counts), journal-entry-by-source-monthly (per
// source row), journal-entry-by-account-monthly (per account
// row).
//
// Pure derivation. No persisted records.

import type { JournalEntry } from './journal-entry';

export interface PortfolioJournalEntryMonthlyRow {
  month: string;
  total: number;
  posted: number;
  draft: number;
  voided: number;
  totalDebitCents: number;
  totalCreditCents: number;
  distinctSources: number;
  distinctAccounts: number;
}

export interface PortfolioJournalEntryMonthlyRollup {
  monthsConsidered: number;
  totalEntries: number;
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface PortfolioJournalEntryMonthlyInputs {
  journalEntries: JournalEntry[];
  fromMonth?: string;
  toMonth?: string;
}

function sumLines(
  lines: { debitCents?: number; creditCents?: number }[] | undefined,
  field: 'debitCents' | 'creditCents',
): number {
  let total = 0;
  for (const ln of lines ?? []) total += ln[field] ?? 0;
  return total;
}

export function buildPortfolioJournalEntryMonthly(
  inputs: PortfolioJournalEntryMonthlyInputs,
): {
  rollup: PortfolioJournalEntryMonthlyRollup;
  rows: PortfolioJournalEntryMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    posted: number;
    draft: number;
    voided: number;
    debitCents: number;
    creditCents: number;
    sources: Set<string>;
    accounts: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalEntries = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const je of inputs.journalEntries) {
    const month = je.entryDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        posted: 0,
        draft: 0,
        voided: 0,
        debitCents: 0,
        creditCents: 0,
        sources: new Set(),
        accounts: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const status = je.status ?? 'DRAFT';
    if (status === 'POSTED') a.posted += 1;
    else if (status === 'DRAFT') a.draft += 1;
    else if (status === 'VOIDED') a.voided += 1;

    if (status === 'POSTED') {
      const d = sumLines(je.lines, 'debitCents');
      const c = sumLines(je.lines, 'creditCents');
      a.debitCents += d;
      a.creditCents += c;
      totalDebit += d;
      totalCredit += c;
    }
    if (je.source) a.sources.add(je.source);
    for (const ln of je.lines ?? []) a.accounts.add(ln.accountNumber);
    totalEntries += 1;
  }

  const rows: PortfolioJournalEntryMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      total: a.total,
      posted: a.posted,
      draft: a.draft,
      voided: a.voided,
      totalDebitCents: a.debitCents,
      totalCreditCents: a.creditCents,
      distinctSources: a.sources.size,
      distinctAccounts: a.accounts.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEntries,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
    },
    rows,
  };
}
