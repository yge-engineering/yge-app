// Portfolio journal-entry snapshot.
//
// Plain English: as-of today, count JEs, sum debit + credit
// cents on posted entries, break down by source + status,
// flag unbalanced entries, count distinct jobs touched, and
// surface YTD totals. Drives the right-now bookkeeping
// activity overview.
//
// Pure derivation. No persisted records.

import type { JournalEntry, JournalEntrySource, JournalEntryStatus } from './journal-entry';

import { isBalanced, totalCreditCents, totalDebitCents } from './journal-entry';

export interface PortfolioJournalEntrySnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalEntries: number;
  ytdEntries: number;
  postedEntries: number;
  draftEntries: number;
  voidedEntries: number;
  unbalancedEntries: number;
  postedDebitCents: number;
  postedCreditCents: number;
  bySource: Partial<Record<JournalEntrySource, number>>;
  byStatus: Partial<Record<JournalEntryStatus, number>>;
  distinctJobs: number;
}

export interface PortfolioJournalEntrySnapshotInputs {
  journalEntries: JournalEntry[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioJournalEntrySnapshot(
  inputs: PortfolioJournalEntrySnapshotInputs,
): PortfolioJournalEntrySnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const bySource = new Map<JournalEntrySource, number>();
  const byStatus = new Map<JournalEntryStatus, number>();
  const jobs = new Set<string>();

  let totalEntries = 0;
  let ytdEntries = 0;
  let postedEntries = 0;
  let draftEntries = 0;
  let voidedEntries = 0;
  let unbalancedEntries = 0;
  let postedDebitCents = 0;
  let postedCreditCents = 0;

  for (const je of inputs.journalEntries) {
    if (je.entryDate > asOf) continue;
    totalEntries += 1;
    if (je.status === 'POSTED') {
      postedEntries += 1;
      postedDebitCents += totalDebitCents(je);
      postedCreditCents += totalCreditCents(je);
    } else if (je.status === 'DRAFT') {
      draftEntries += 1;
    } else if (je.status === 'VOIDED') {
      voidedEntries += 1;
    }
    if (!isBalanced(je)) unbalancedEntries += 1;
    bySource.set(je.source, (bySource.get(je.source) ?? 0) + 1);
    byStatus.set(je.status, (byStatus.get(je.status) ?? 0) + 1);
    for (const l of je.lines) if (l.jobId) jobs.add(l.jobId);
    if (Number(je.entryDate.slice(0, 4)) === logYear) ytdEntries += 1;
  }

  const sOut: Partial<Record<JournalEntrySource, number>> = {};
  for (const [k, v] of bySource) sOut[k] = v;
  const stOut: Partial<Record<JournalEntryStatus, number>> = {};
  for (const [k, v] of byStatus) stOut[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalEntries,
    ytdEntries,
    postedEntries,
    draftEntries,
    voidedEntries,
    unbalancedEntries,
    postedDebitCents,
    postedCreditCents,
    bySource: sOut,
    byStatus: stOut,
    distinctJobs: jobs.size,
  };
}
