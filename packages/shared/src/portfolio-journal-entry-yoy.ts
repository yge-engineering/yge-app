// Portfolio journal-entry year-over-year.
//
// Plain English: collapse two years of journal entries into a
// comparison row with status mix + posted debits/credits +
// distinct sources/accounts + delta. Sized for the year-end
// close + automation-maturity story.
//
// Different from portfolio-journal-entry-monthly (per month).
//
// Pure derivation. No persisted records.

import type { JournalEntry } from './journal-entry';

export interface PortfolioJournalEntryYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorPosted: number;
  priorDraft: number;
  priorVoided: number;
  priorTotalDebitCents: number;
  priorTotalCreditCents: number;
  priorDistinctSources: number;
  priorDistinctAccounts: number;
  currentTotal: number;
  currentPosted: number;
  currentDraft: number;
  currentVoided: number;
  currentTotalDebitCents: number;
  currentTotalCreditCents: number;
  currentDistinctSources: number;
  currentDistinctAccounts: number;
  totalDelta: number;
}

export interface PortfolioJournalEntryYoyInputs {
  journalEntries: JournalEntry[];
  currentYear: number;
}

function sumLines(
  lines: { debitCents?: number; creditCents?: number }[] | undefined,
  field: 'debitCents' | 'creditCents',
): number {
  let total = 0;
  for (const ln of lines ?? []) total += ln[field] ?? 0;
  return total;
}

export function buildPortfolioJournalEntryYoy(
  inputs: PortfolioJournalEntryYoyInputs,
): PortfolioJournalEntryYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    posted: number;
    draft: number;
    voided: number;
    debitCents: number;
    creditCents: number;
    sources: Set<string>;
    accounts: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      posted: 0,
      draft: 0,
      voided: 0,
      debitCents: 0,
      creditCents: 0,
      sources: new Set(),
      accounts: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const je of inputs.journalEntries) {
    const year = Number(je.entryDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status = je.status ?? 'DRAFT';
    if (status === 'POSTED') b.posted += 1;
    else if (status === 'DRAFT') b.draft += 1;
    else if (status === 'VOIDED') b.voided += 1;
    if (status === 'POSTED') {
      b.debitCents += sumLines(je.lines, 'debitCents');
      b.creditCents += sumLines(je.lines, 'creditCents');
    }
    if (je.source) b.sources.add(je.source);
    for (const ln of je.lines ?? []) b.accounts.add(ln.accountNumber);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorPosted: prior.posted,
    priorDraft: prior.draft,
    priorVoided: prior.voided,
    priorTotalDebitCents: prior.debitCents,
    priorTotalCreditCents: prior.creditCents,
    priorDistinctSources: prior.sources.size,
    priorDistinctAccounts: prior.accounts.size,
    currentTotal: current.total,
    currentPosted: current.posted,
    currentDraft: current.draft,
    currentVoided: current.voided,
    currentTotalDebitCents: current.debitCents,
    currentTotalCreditCents: current.creditCents,
    currentDistinctSources: current.sources.size,
    currentDistinctAccounts: current.accounts.size,
    totalDelta: current.total - prior.total,
  };
}
