// Per (job, month) journal-entry line rollup.
//
// Plain English: walk every POSTED journal entry's lines, pick
// the ones with a jobId on the line, bucket by (jobId, yyyy-mm
// of entryDate). Sums debits + credits per (job, month).
// Useful for the cost-coding audit and for reconciling the
// per-job cost report against the GL.
//
// Per row: jobId, month, lines, debitCents, creditCents,
// netCents, distinctEntries, distinctAccounts.
//
// Sort: jobId asc, month asc.
//
// Different from journal-entry-by-account-monthly (per GL
// account), journal-entry-by-source-monthly (per source),
// journal-entry-monthly (per-month total).
//
// Pure derivation. No persisted records.

import type { JournalEntry } from './journal-entry';

export interface JournalEntryByJobMonthlyRow {
  jobId: string;
  month: string;
  lines: number;
  debitCents: number;
  creditCents: number;
  netCents: number;
  distinctEntries: number;
  distinctAccounts: number;
}

export interface JournalEntryByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalLines: number;
  totalDebitCents: number;
  totalCreditCents: number;
  unattributed: number;
  draftSkipped: number;
  voidedSkipped: number;
}

export interface JournalEntryByJobMonthlyInputs {
  journalEntries: JournalEntry[];
  /** Optional yyyy-mm bounds inclusive applied to entryDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJournalEntryByJobMonthly(
  inputs: JournalEntryByJobMonthlyInputs,
): {
  rollup: JournalEntryByJobMonthlyRollup;
  rows: JournalEntryByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    lines: number;
    debitCents: number;
    creditCents: number;
    entries: Set<string>;
    accounts: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalLines = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let unattributed = 0;
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
      if (!line.jobId) {
        unattributed += 1;
        continue;
      }
      const key = `${line.jobId}__${month}`;
      let a = accs.get(key);
      if (!a) {
        a = {
          jobId: line.jobId,
          month,
          lines: 0,
          debitCents: 0,
          creditCents: 0,
          entries: new Set(),
          accounts: new Set(),
        };
        accs.set(key, a);
      }
      a.lines += 1;
      a.debitCents += line.debitCents ?? 0;
      a.creditCents += line.creditCents ?? 0;
      a.entries.add(je.id);
      a.accounts.add(line.accountNumber);

      jobs.add(line.jobId);
      months.add(month);
      totalLines += 1;
      totalDebit += line.debitCents ?? 0;
      totalCredit += line.creditCents ?? 0;
    }
  }

  const rows: JournalEntryByJobMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      jobId: a.jobId,
      month: a.month,
      lines: a.lines,
      debitCents: a.debitCents,
      creditCents: a.creditCents,
      netCents: a.debitCents - a.creditCents,
      distinctEntries: a.entries.size,
      distinctAccounts: a.accounts.size,
    }))
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalLines,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
      unattributed,
      draftSkipped,
      voidedSkipped,
    },
    rows,
  };
}
