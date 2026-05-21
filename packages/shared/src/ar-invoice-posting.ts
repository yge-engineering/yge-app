// AR invoice -> general-ledger journal entry.
//
// Turns a customer/agency invoice into the GL entry that recognizes the
// revenue and the receivable. Construction progress-billing convention:
//
//   Debit  A/R control          totalCents       (current amount owed)
//   Debit  Retention Receivable retentionCents   (held back per contract)
//   Credit Sales/Use Tax Payable taxCents         (if any; usually 0 — PW is exempt)
//   Credit Contract Revenue     (balancing)       (work earned this billing)
//
// Revenue is the plug, so the entry ALWAYS balances regardless of small
// data inconsistencies. The entry is DRAFT — a human reviews and posts it;
// nothing hits the trial balance until they do.

import type { ArInvoice } from './ar-invoice';
import type { JournalEntryCreate, JournalEntryLine } from './journal-entry';

/** Default control/clearing accounts, matching the seeded chart of accounts. */
export const AR_POSTING_DEFAULTS = {
  arControl: '11000',
  revenue: '40100',
  salesTax: '21300',
  retentionReceivable: '11100',
} as const;

export interface ArPostingAccounts {
  /** A/R control account (asset). */
  arControl: string;
  /** Revenue account credited for the work earned. */
  revenue: string;
  /** Sales/use tax payable (liability). Omit if the customer is tax-exempt. */
  salesTax?: string;
  /** Retention receivable (asset). Omit to fold retention into the receivable. */
  retentionReceivable?: string;
}

export interface ArPostingOptions {
  /** Posting date; defaults to the invoice date. */
  entryDate?: string;
  /** Memo override; defaults to "AR invoice <#> — <customer>". */
  memo?: string;
}

export interface ArPostingResult {
  entry: JournalEntryCreate | null;
  warnings: string[];
}

type ArInvoiceForPosting = Pick<
  ArInvoice,
  'id' | 'invoiceNumber' | 'customerName' | 'invoiceDate' | 'taxCents' | 'retentionCents' | 'totalCents'
>;

export function buildArInvoiceJournalEntry(
  invoice: ArInvoiceForPosting,
  accounts: ArPostingAccounts,
  options: ArPostingOptions = {},
): ArPostingResult {
  const warnings: string[] = [];
  const taxCents = invoice.taxCents ?? 0;
  const retentionCents = invoice.retentionCents ?? 0;

  const arDebit = invoice.totalCents;
  if (arDebit <= 0) {
    return { entry: null, warnings: ['Invoice total is zero — nothing to post.'] };
  }

  let retentionDebit = 0;
  if (retentionCents > 0) {
    if (accounts.retentionReceivable) retentionDebit = retentionCents;
    else warnings.push('No retention-receivable account set — retention folded into the revenue line.');
  }

  let taxCredit = 0;
  if (taxCents > 0) {
    if (accounts.salesTax) taxCredit = taxCents;
    else warnings.push('No sales-tax account set — tax folded into the revenue line.');
  }

  const revenueCredit = arDebit + retentionDebit - taxCredit;
  if (revenueCredit <= 0) {
    return {
      entry: null,
      warnings: [...warnings, 'Computed revenue is not positive — check the invoice tax/retention amounts.'],
    };
  }

  const lines: JournalEntryLine[] = [
    { accountNumber: accounts.arControl, debitCents: arDebit, creditCents: 0 },
  ];
  if (retentionDebit > 0) {
    lines.push({ accountNumber: accounts.retentionReceivable!, debitCents: retentionDebit, creditCents: 0 });
  }
  lines.push({ accountNumber: accounts.revenue, debitCents: 0, creditCents: revenueCredit });
  if (taxCredit > 0) {
    lines.push({ accountNumber: accounts.salesTax!, debitCents: 0, creditCents: taxCredit });
  }

  const entry: JournalEntryCreate = {
    entryDate: options.entryDate ?? invoice.invoiceDate,
    memo: options.memo ?? `AR invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
    source: 'AR_INVOICE',
    sourceRef: invoice.id,
    status: 'DRAFT',
    lines,
  };

  return { entry, warnings };
}
