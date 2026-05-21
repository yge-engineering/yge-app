// AP invoice (vendor bill) -> general-ledger journal entry.
//
//   Debit  expense / COGS   (per line glCode when it's a real account number,
//                            otherwise the default expense bucket)
//   Credit A/P control      totalCents   (what we owe the vendor)
//
// Line glCodes are free-form in Phase 1, so only numeric (4-6 digit) codes
// become their own debit; everything else — uncoded lines, tax, freight,
// rounding — lands in the default expense account so the entry always ties
// to the bill total. DRAFT only; a human reviews and posts.

import type { ApInvoice } from './ap-invoice';
import type { JournalEntryCreate, JournalEntryLine } from './journal-entry';

export const AP_POSTING_DEFAULTS = {
  apControl: '20100',
  defaultExpense: '58000', // Other Direct Job Cost
} as const;

export interface ApPostingAccounts {
  /** A/P control account (liability). */
  apControl: string;
  /** Fallback expense for uncoded lines / tax / freight / rounding. */
  defaultExpense: string;
}

export interface ApPostingOptions {
  entryDate?: string;
  memo?: string;
}

export interface ApPostingResult {
  entry: JournalEntryCreate | null;
  warnings: string[];
}

type ApInvoiceForPosting = Pick<
  ApInvoice,
  'id' | 'invoiceNumber' | 'vendorName' | 'invoiceDate' | 'totalCents' | 'lineItems'
>;

function isAccountNumber(code: string | undefined): code is string {
  return !!code && /^\d{4,6}$/.test(code);
}

export function buildApInvoiceJournalEntry(
  invoice: ApInvoiceForPosting,
  accounts: ApPostingAccounts,
  options: ApPostingOptions = {},
): ApPostingResult {
  const warnings: string[] = [];
  const total = invoice.totalCents;
  if (total <= 0) {
    return { entry: null, warnings: ['Bill total is zero — nothing to post.'] };
  }

  // Sum debits per numeric GL code from the line items.
  const byAccount = new Map<string, number>();
  let coded = 0;
  let sawNonNumericCode = false;
  for (const line of invoice.lineItems ?? []) {
    if (isAccountNumber(line.glCode)) {
      byAccount.set(line.glCode, (byAccount.get(line.glCode) ?? 0) + line.lineTotalCents);
      coded += line.lineTotalCents;
    } else if (line.glCode) {
      sawNonNumericCode = true;
    }
  }
  if (sawNonNumericCode) {
    warnings.push('Some line GL codes are not chart-of-accounts numbers — those amounts went to the default expense account.');
  }

  if (coded > total) {
    // Inconsistent data: coded lines exceed the bill total. Don't trust the
    // coding — book the whole bill to the default expense.
    warnings.push('Line GL-coded amounts exceed the bill total — posted the full amount to the default expense account instead.');
    byAccount.clear();
    byAccount.set(accounts.defaultExpense, total);
  } else {
    const remainder = total - coded;
    if (remainder > 0) {
      byAccount.set(accounts.defaultExpense, (byAccount.get(accounts.defaultExpense) ?? 0) + remainder);
    }
  }

  const lines: JournalEntryLine[] = [];
  for (const [accountNumber, debitCents] of byAccount.entries()) {
    if (debitCents > 0) lines.push({ accountNumber, debitCents, creditCents: 0 });
  }
  // Stable order: debits by account number ascending, then the AP credit.
  lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  lines.push({ accountNumber: accounts.apControl, debitCents: 0, creditCents: total });

  const entry: JournalEntryCreate = {
    entryDate: options.entryDate ?? invoice.invoiceDate,
    memo: options.memo ?? `AP bill ${invoice.invoiceNumber ?? '(no #)'} — ${invoice.vendorName}`,
    source: 'AP_INVOICE',
    sourceRef: invoice.id,
    status: 'DRAFT',
    lines,
  };

  return { entry, warnings };
}
