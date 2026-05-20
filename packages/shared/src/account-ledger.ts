// Account ledger (general-ledger detail) for one account over a period.
//
// computeAccountBalances() rolls everything up to a single debit/credit per
// account; this drills the other way — every posted journal-entry line that
// hit the account, in date order, with a running balance. It's the detail
// behind a trial-balance row or an income-statement line.
//
// POSTED entries only (drafts/voided don't affect the books), matching
// computeAccountBalances. Dates are ISO yyyy-mm-dd, compared lexically.

import type { JournalEntry } from './journal-entry';

export interface AccountLedgerLine {
  entryId: string;
  entryDate: string;
  /** Journal-entry memo (header). */
  memo: string;
  /** Per-line memo, when present. */
  lineMemo?: string;
  source: string;
  debitCents: number;
  creditCents: number;
  /** Debit-positive running balance after this line. */
  runningBalanceCents: number;
}

export interface AccountLedger {
  accountNumber: string;
  /** Debit-positive balance carried in from before periodStart (0 when no
   *  start is given — the ledger is then all-time). */
  openingBalanceCents: number;
  lines: AccountLedgerLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  /** Opening + period activity, debit-positive. */
  endingBalanceCents: number;
}

export interface AccountLedgerOptions {
  /** Inclusive ISO start. Lines before this roll into the opening balance. */
  periodStart?: string;
  /** Inclusive ISO end. Lines after this are excluded. */
  periodEnd?: string;
}

export function buildAccountLedger(
  entries: JournalEntry[],
  accountNumber: string,
  options: AccountLedgerOptions = {},
): AccountLedger {
  const { periodStart, periodEnd } = options;

  // Gather every posted line that hit this account, with its entry context.
  interface Hit {
    entryId: string;
    entryDate: string;
    memo: string;
    lineMemo?: string;
    source: string;
    debitCents: number;
    creditCents: number;
  }
  const hits: Hit[] = [];
  let openingBalanceCents = 0;

  for (const je of entries) {
    if (je.status !== 'POSTED') continue;
    for (const line of je.lines) {
      if (line.accountNumber !== accountNumber) continue;
      // Before the window -> opening balance.
      if (periodStart && je.entryDate < periodStart) {
        openingBalanceCents += line.debitCents - line.creditCents;
        continue;
      }
      // After the window -> skip.
      if (periodEnd && je.entryDate > periodEnd) continue;
      hits.push({
        entryId: je.id,
        entryDate: je.entryDate,
        memo: je.memo,
        ...(line.memo ? { lineMemo: line.memo } : {}),
        source: je.source,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
      });
    }
  }

  // Date order, then entry id for stability.
  hits.sort((a, b) => {
    if (a.entryDate !== b.entryDate) return a.entryDate.localeCompare(b.entryDate);
    return a.entryId.localeCompare(b.entryId);
  });

  let running = openingBalanceCents;
  let totalDebitCents = 0;
  let totalCreditCents = 0;
  const lines: AccountLedgerLine[] = hits.map((h) => {
    running += h.debitCents - h.creditCents;
    totalDebitCents += h.debitCents;
    totalCreditCents += h.creditCents;
    return {
      entryId: h.entryId,
      entryDate: h.entryDate,
      memo: h.memo,
      ...(h.lineMemo ? { lineMemo: h.lineMemo } : {}),
      source: h.source,
      debitCents: h.debitCents,
      creditCents: h.creditCents,
      runningBalanceCents: running,
    };
  });

  return {
    accountNumber,
    openingBalanceCents,
    lines,
    totalDebitCents,
    totalCreditCents,
    endingBalanceCents: running,
  };
}
