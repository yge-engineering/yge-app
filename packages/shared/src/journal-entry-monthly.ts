// Journal entry volume by month.
//
// Plain English: bucket JEs by yyyy-mm of entryDate so the
// bookkeeper sees how many entries posted each month, broken
// down by status (DRAFT / POSTED / VOIDED) and by source. Useful
// for the close checklist — at month-end every JE for the period
// should be POSTED, no DRAFTs lingering.
//
// Per row: month, total, posted, draft, voided, totalDebitCents,
// totalCreditCents, distinctAuthors (sources).
//
// Sort by month asc.
//
// Different from journal-entry helpers (per-entry) and
// trial-balance (per-account). This is the volume-over-time
// view.
//
// Pure derivation. No persisted records.

import type { JournalEntry, JournalEntryStatus } from './journal-entry';

export interface JournalEntryMonthlyRow {
  month: string;
  total: number;
  posted: number;
  draft: number;
  voided: number;
  totalDebitCents: number;
  totalCreditCents: number;
  distinctSources: number;
}

export interface JournalEntryMonthlyRollup {
  monthsConsidered: number;
  totalEntries: number;
  monthOverMonthCountChange: number;
}

export interface JournalEntryMonthlyInputs {
  journalEntries: JournalEntry[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJournalEntryMonthly(
  inputs: JournalEntryMonthlyInputs,
): {
  rollup: JournalEntryMonthlyRollup;
  rows: JournalEntryMonthlyRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<JournalEntryStatus, number>;
    debit: number;
    credit: number;
    sources: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: { DRAFT: 0, POSTED: 0, VOIDED: 0 },
    debit: 0,
    credit: 0,
    sources: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const je of inputs.journalEntries) {
    const month = je.entryDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[je.status] += 1;
    for (const line of je.lines) {
      b.debit += line.debitCents;
      b.credit += line.creditCents;
    }
    b.sources.add(je.source);
    buckets.set(month, b);
  }

  const rows: JournalEntryMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        posted: b.counts.POSTED,
        draft: b.counts.DRAFT,
        voided: b.counts.VOIDED,
        totalDebitCents: b.debit,
        totalCreditCents: b.credit,
        distinctSources: b.sources.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.total - prev.total;
  }

  let totalEntries = 0;
  for (const r of rows) totalEntries += r.total;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEntries,
      monthOverMonthCountChange: mom,
    },
    rows,
  };
}
