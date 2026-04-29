// Per (account, month) journal entry rollup.
//
// Plain English: walk every POSTED journal entry's lines, bucket
// by (accountNumber, yyyy-mm of entryDate), sum debits + credits.
// Tells the bookkeeper how each GL account moved month-over-
// month — the closest thing to a per-account general ledger
// summary without spinning up the full ledger view.
//
// Per row: accountNumber, month, lines, debitCents, creditCents,
// netCents (debits − credits), distinctEntries, distinctJobs.
//
// Sort: accountNumber asc, month asc.
//
// Different from journal-entry-by-source (no time axis),
// journal-entry-monthly (per-month total status mix, no account
// axis), income-statement / balance-sheet (point-in-time).
//
// Pure derivation. No persisted records.

import type { JournalEntry } from './journal-entry';

export interface JournalEntryByAccountMonthlyRow {
  accountNumber: string;
  month: string;
  lines: number;
  debitCents: number;
  creditCents: number;
  netCents: number;
  distinctEntries: number;
  distinctJobs: number;
}

export interface JournalEntryByAccountMonthlyRollup {
  accountsConsidered: number;
  monthsConsidered: number;
  totalLines: number;
  totalDebitCents: number;
  totalCreditCents: number;
  draftSkipped: number;
  voidedSkipped: number;
}

export interface JournalEntryByAccountMonthlyInputs {
  journalEntries: JournalEntry[];
  /** Optional yyyy-mm bounds inclusive applied to entryDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJournalEntryByAccountMonthly(
  inputs: JournalEntryByAccountMonthlyInputs,
): {
  rollup: JournalEntryByAccountMonthlyRollup;
  rows: JournalEntryByAccountMonthlyRow[];
} {
  type Acc = {
    accountNumber: string;
    month: string;
    lines: number;
    debitCents: number;
    creditCents: number;
    entries: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const accountsSeen = new Set<string>();
  const monthsSeen = new Set<string>();

  let totalLines = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let draftSkipped = 0;
  let voidedSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const je of inputs.journalEntries) {
    const status = je.status ?? 'DRAFT';
    if (status === 'DRAFT') {
      draftSkipped += 1;
      continue;
    }
    if (status === 'VOIDED') {
      voidedSkipped += 1;
      continue;
    }
    const month = je.entryDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    for (const line of je.lines ?? []) {
      const key = `${line.accountNumber}__${month}`;
      let a = accs.get(key);
      if (!a) {
        a = {
          accountNumber: line.accountNumber,
          month,
          lines: 0,
          debitCents: 0,
          creditCents: 0,
          entries: new Set(),
          jobs: new Set(),
        };
        accs.set(key, a);
      }
      a.lines += 1;
      a.debitCents += line.debitCents ?? 0;
      a.creditCents += line.creditCents ?? 0;
      a.entries.add(je.id);
      if (line.jobId) a.jobs.add(line.jobId);

      accountsSeen.add(line.accountNumber);
      monthsSeen.add(month);
      totalLines += 1;
      totalDebit += line.debitCents ?? 0;
      totalCredit += line.creditCents ?? 0;
    }
  }

  const rows: JournalEntryByAccountMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      accountNumber: a.accountNumber,
      month: a.month,
      lines: a.lines,
      debitCents: a.debitCents,
      creditCents: a.creditCents,
      netCents: a.debitCents - a.creditCents,
      distinctEntries: a.entries.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.accountNumber !== y.accountNumber) {
        return x.accountNumber.localeCompare(y.accountNumber);
      }
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      accountsConsidered: accountsSeen.size,
      monthsConsidered: monthsSeen.size,
      totalLines,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
      draftSkipped,
      voidedSkipped,
    },
    rows,
  };
}
