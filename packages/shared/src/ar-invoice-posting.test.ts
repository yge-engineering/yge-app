import { describe, expect, it } from 'vitest';
import {
  AR_POSTING_DEFAULTS,
  buildArInvoiceJournalEntry,
  type ArPostingAccounts,
} from './ar-invoice-posting';
import type { ArInvoice } from './ar-invoice';

const ACCT: ArPostingAccounts = {
  arControl: AR_POSTING_DEFAULTS.arControl,
  revenue: AR_POSTING_DEFAULTS.revenue,
  salesTax: AR_POSTING_DEFAULTS.salesTax,
  retentionReceivable: AR_POSTING_DEFAULTS.retentionReceivable,
};

function inv(over: Partial<ArInvoice> = {}): ArInvoice['id'] extends never ? never : Parameters<typeof buildArInvoiceJournalEntry>[0] {
  return {
    id: 'ar-1',
    invoiceNumber: '1001',
    customerName: 'County of Shasta',
    invoiceDate: '2026-03-15',
    totalCents: 100000,
    ...over,
  };
}

function debits(lines: { debitCents: number }[]): number {
  return lines.reduce((s, l) => s + l.debitCents, 0);
}
function credits(lines: { creditCents: number }[]): number {
  return lines.reduce((s, l) => s + l.creditCents, 0);
}

describe('buildArInvoiceJournalEntry', () => {
  it('posts a simple invoice: Debit AR, Credit revenue, balanced', () => {
    const { entry } = buildArInvoiceJournalEntry(inv(), ACCT);
    expect(entry).not.toBeNull();
    expect(entry!.source).toBe('AR_INVOICE');
    expect(entry!.sourceRef).toBe('ar-1');
    expect(entry!.status).toBe('DRAFT');
    expect(entry!.entryDate).toBe('2026-03-15');
    const ar = entry!.lines.find((l) => l.accountNumber === '11000')!;
    const rev = entry!.lines.find((l) => l.accountNumber === '40100')!;
    expect(ar.debitCents).toBe(100000);
    expect(rev.creditCents).toBe(100000);
    expect(debits(entry!.lines)).toBe(credits(entry!.lines));
  });

  it('splits sales tax to the tax-payable account', () => {
    const { entry } = buildArInvoiceJournalEntry(inv({ totalCents: 108000, taxCents: 8000 }), ACCT);
    const rev = entry!.lines.find((l) => l.accountNumber === '40100')!;
    const tax = entry!.lines.find((l) => l.accountNumber === '21300')!;
    expect(rev.creditCents).toBe(100000);
    expect(tax.creditCents).toBe(8000);
    expect(debits(entry!.lines)).toBe(credits(entry!.lines));
  });

  it('books retention to retention receivable', () => {
    const { entry } = buildArInvoiceJournalEntry(inv({ totalCents: 90000, retentionCents: 10000 }), ACCT);
    const ar = entry!.lines.find((l) => l.accountNumber === '11000')!;
    const ret = entry!.lines.find((l) => l.accountNumber === '11100')!;
    const rev = entry!.lines.find((l) => l.accountNumber === '40100')!;
    expect(ar.debitCents).toBe(90000);
    expect(ret.debitCents).toBe(10000);
    expect(rev.creditCents).toBe(100000); // work earned = billed + retention
    expect(debits(entry!.lines)).toBe(credits(entry!.lines));
  });

  it('folds tax into revenue + warns when no tax account is set', () => {
    const { entry, warnings } = buildArInvoiceJournalEntry(
      inv({ totalCents: 108000, taxCents: 8000 }),
      { arControl: '11000', revenue: '40100' },
    );
    const rev = entry!.lines.find((l) => l.accountNumber === '40100')!;
    expect(rev.creditCents).toBe(108000);
    expect(entry!.lines.some((l) => l.accountNumber === '21300')).toBe(false);
    expect(warnings.some((w) => w.includes('tax'))).toBe(true);
    expect(debits(entry!.lines)).toBe(credits(entry!.lines));
  });

  it('returns null for a zero-total invoice', () => {
    const { entry, warnings } = buildArInvoiceJournalEntry(inv({ totalCents: 0 }), ACCT);
    expect(entry).toBeNull();
    expect(warnings[0]).toMatch(/zero/);
  });

  it('honors memo + entryDate overrides', () => {
    const { entry } = buildArInvoiceJournalEntry(inv(), ACCT, {
      entryDate: '2026-03-31',
      memo: 'Custom',
    });
    expect(entry!.entryDate).toBe('2026-03-31');
    expect(entry!.memo).toBe('Custom');
  });

  it('every line is a debit XOR a credit', () => {
    const { entry } = buildArInvoiceJournalEntry(inv({ totalCents: 108000, taxCents: 8000, retentionCents: 5000 }), ACCT);
    for (const l of entry!.lines) {
      expect((l.debitCents > 0) !== (l.creditCents > 0)).toBe(true);
    }
    expect(debits(entry!.lines)).toBe(credits(entry!.lines));
  });
});
