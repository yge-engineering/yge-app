// Per (source, month) journal-entry rollup.
//
// Plain English: bucket JEs by (JournalEntrySource, yyyy-mm of
// entryDate). Tracks the automation-maturity story month over
// month — heavy MANUAL count means books are being kept by
// hand; rising AP_INVOICE + AR_INVOICE means automation is
// taking over the typing.
//
// Per row: source, month, count, posted, voided, draft,
// totalDebitCents, totalCreditCents.
//
// Sort: month asc, source asc within month.
//
// Different from journal-entry-by-source (lifetime portfolio,
// no time axis), journal-entry-monthly (per-month total status
// mix, no source axis), journal-entry-by-account-monthly (per
// GL account, no source axis).
//
// Pure derivation. No persisted records.

import type { JournalEntry, JournalEntrySource } from './journal-entry';

export interface JournalEntryBySourceMonthlyRow {
  source: JournalEntrySource;
  month: string;
  count: number;
  posted: number;
  voided: number;
  draft: number;
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface JournalEntryBySourceMonthlyRollup {
  sourcesConsidered: number;
  monthsConsidered: number;
  totalEntries: number;
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface JournalEntryBySourceMonthlyInputs {
  journalEntries: JournalEntry[];
  /** Optional yyyy-mm bounds inclusive applied to entryDate. */
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

export function buildJournalEntryBySourceMonthly(
  inputs: JournalEntryBySourceMonthlyInputs,
): {
  rollup: JournalEntryBySourceMonthlyRollup;
  rows: JournalEntryBySourceMonthlyRow[];
} {
  type Acc = {
    source: JournalEntrySource;
    month: string;
    count: number;
    posted: number;
    voided: number;
    draft: number;
    totalDebitCents: number;
    totalCreditCents: number;
  };
  const accs = new Map<string, Acc>();
  const sourcesSeen = new Set<JournalEntrySource>();
  const monthsSeen = new Set<string>();

  let totalEntries = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const je of inputs.journalEntries) {
    const month = je.entryDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const source: JournalEntrySource = je.source ?? 'MANUAL';
    const key = `${source}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        source,
        month,
        count: 0,
        posted: 0,
        voided: 0,
        draft: 0,
        totalDebitCents: 0,
        totalCreditCents: 0,
      };
      accs.set(key, a);
    }
    a.count += 1;
    const status = je.status ?? 'DRAFT';
    if (status === 'POSTED') a.posted += 1;
    else if (status === 'VOIDED') a.voided += 1;
    else if (status === 'DRAFT') a.draft += 1;
    if (status === 'POSTED') {
      const d = sumLines(je.lines, 'debitCents');
      const c = sumLines(je.lines, 'creditCents');
      a.totalDebitCents += d;
      a.totalCreditCents += c;
      totalDebit += d;
      totalCredit += c;
    }

    sourcesSeen.add(source);
    monthsSeen.add(month);
    totalEntries += 1;
  }

  const rows: JournalEntryBySourceMonthlyRow[] = [...accs.values()].sort(
    (x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return x.source.localeCompare(y.source);
    },
  );

  return {
    rollup: {
      sourcesConsidered: sourcesSeen.size,
      monthsConsidered: monthsSeen.size,
      totalEntries,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
    },
    rows,
  };
}
