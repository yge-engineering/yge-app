// Journal entry volume by source.
//
// Plain English: roll JEs up by source (MANUAL, AP_INVOICE,
// AP_PAYMENT, AR_INVOICE, AR_PAYMENT, PAYROLL, DEPRECIATION,
// CASH_TRANSFER, ADJUSTING, CLOSING, OTHER). Heavy MANUAL
// volume = books being kept by hand. Heavy AP_INVOICE +
// AR_INVOICE = books being kept by automation. Tracking the
// shift over time shows automation maturity.
//
// Per row: source, count, posted, voided, draft, totalDebitCents,
// totalCreditCents, share (of total posted JEs).
//
// Sort by count desc.
//
// Different from journal-entry-monthly (per-month). This is the
// source breakdown.
//
// Pure derivation. No persisted records.

import type { JournalEntry, JournalEntrySource } from './journal-entry';

export interface JournalEntryBySourceRow {
  source: JournalEntrySource;
  count: number;
  posted: number;
  voided: number;
  draft: number;
  totalDebitCents: number;
  totalCreditCents: number;
  share: number;
}

export interface JournalEntryBySourceRollup {
  sourcesConsidered: number;
  totalEntries: number;
  totalPosted: number;
}

export interface JournalEntryBySourceInputs {
  journalEntries: JournalEntry[];
  /** Optional yyyy-mm-dd window applied to entryDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildJournalEntryBySource(
  inputs: JournalEntryBySourceInputs,
): {
  rollup: JournalEntryBySourceRollup;
  rows: JournalEntryBySourceRow[];
} {
  type Acc = {
    count: number;
    posted: number;
    voided: number;
    draft: number;
    debit: number;
    credit: number;
  };
  const accs = new Map<JournalEntrySource, Acc>();
  let portfolioTotal = 0;
  let portfolioPosted = 0;

  for (const je of inputs.journalEntries) {
    if (inputs.fromDate && je.entryDate < inputs.fromDate) continue;
    if (inputs.toDate && je.entryDate > inputs.toDate) continue;
    portfolioTotal += 1;
    if (je.status === 'POSTED') portfolioPosted += 1;
    const acc = accs.get(je.source) ?? {
      count: 0,
      posted: 0,
      voided: 0,
      draft: 0,
      debit: 0,
      credit: 0,
    };
    acc.count += 1;
    if (je.status === 'POSTED') acc.posted += 1;
    else if (je.status === 'VOIDED') acc.voided += 1;
    else if (je.status === 'DRAFT') acc.draft += 1;
    for (const line of je.lines) {
      acc.debit += line.debitCents;
      acc.credit += line.creditCents;
    }
    accs.set(je.source, acc);
  }

  const rows: JournalEntryBySourceRow[] = [];
  for (const [source, acc] of accs.entries()) {
    const share = portfolioPosted === 0
      ? 0
      : Math.round((acc.posted / portfolioPosted) * 10_000) / 10_000;
    rows.push({
      source,
      count: acc.count,
      posted: acc.posted,
      voided: acc.voided,
      draft: acc.draft,
      totalDebitCents: acc.debit,
      totalCreditCents: acc.credit,
      share,
    });
  }

  rows.sort((a, b) => b.count - a.count);

  return {
    rollup: {
      sourcesConsidered: rows.length,
      totalEntries: portfolioTotal,
      totalPosted: portfolioPosted,
    },
    rows,
  };
}
