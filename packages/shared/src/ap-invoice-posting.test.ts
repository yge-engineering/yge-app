import { describe, expect, it } from 'vitest';
import {
  AP_POSTING_DEFAULTS,
  buildApInvoiceJournalEntry,
  type ApPostingAccounts,
} from './ap-invoice-posting';

const ACCT: ApPostingAccounts = {
  apControl: AP_POSTING_DEFAULTS.apControl,
  defaultExpense: AP_POSTING_DEFAULTS.defaultExpense,
};

type Inv = Parameters<typeof buildApInvoiceJournalEntry>[0];
function inv(over: Partial<Inv> = {}): Inv {
  return {
    id: 'ap-1',
    invoiceNumber: 'B-77',
    vendorName: 'Apex Grading Inc',
    invoiceDate: '2026-02-01',
    totalCents: 80000,
    lineItems: [],
    ...over,
  } as Inv;
}

const dr = (ls: { debitCents: number }[]) => ls.reduce((s, l) => s + l.debitCents, 0);
const cr = (ls: { creditCents: number }[]) => ls.reduce((s, l) => s + l.creditCents, 0);

describe('buildApInvoiceJournalEntry', () => {
  it('posts an uncoded bill to the default expense, credit AP', () => {
    const { entry } = buildApInvoiceJournalEntry(inv(), ACCT);
    expect(entry).not.toBeNull();
    expect(entry!.source).toBe('AP_INVOICE');
    expect(entry!.status).toBe('DRAFT');
    const exp = entry!.lines.find((l) => l.accountNumber === '58000')!;
    const ap = entry!.lines.find((l) => l.accountNumber === '20100')!;
    expect(exp.debitCents).toBe(80000);
    expect(ap.creditCents).toBe(80000);
    expect(dr(entry!.lines)).toBe(cr(entry!.lines));
  });

  it('debits numeric line GL codes', () => {
    const { entry } = buildApInvoiceJournalEntry(
      inv({
        totalCents: 80000,
        lineItems: [
          { description: 'Aggregate', quantity: 1, unitPriceCents: 50000, lineTotalCents: 50000, glCode: '52000' },
          { description: 'Hauling', quantity: 1, unitPriceCents: 30000, lineTotalCents: 30000, glCode: '56000' },
        ],
      }),
      ACCT,
    );
    expect(entry!.lines.find((l) => l.accountNumber === '52000')!.debitCents).toBe(50000);
    expect(entry!.lines.find((l) => l.accountNumber === '56000')!.debitCents).toBe(30000);
    expect(entry!.lines.some((l) => l.accountNumber === '58000')).toBe(false);
    expect(dr(entry!.lines)).toBe(cr(entry!.lines));
  });

  it('plugs the remainder (tax/freight/uncoded) to the default expense', () => {
    const { entry } = buildApInvoiceJournalEntry(
      inv({
        totalCents: 88000, // 80000 coded + 8000 tax/freight
        lineItems: [
          { description: 'Materials', quantity: 1, unitPriceCents: 80000, lineTotalCents: 80000, glCode: '52000' },
        ],
      }),
      ACCT,
    );
    expect(entry!.lines.find((l) => l.accountNumber === '52000')!.debitCents).toBe(80000);
    expect(entry!.lines.find((l) => l.accountNumber === '58000')!.debitCents).toBe(8000);
    expect(dr(entry!.lines)).toBe(cr(entry!.lines));
  });

  it('warns + folds non-numeric GL codes into the default expense', () => {
    const { entry, warnings } = buildApInvoiceJournalEntry(
      inv({
        totalCents: 80000,
        lineItems: [
          { description: 'Stuff', quantity: 1, unitPriceCents: 80000, lineTotalCents: 80000, glCode: 'Materials' },
        ],
      }),
      ACCT,
    );
    expect(entry!.lines.find((l) => l.accountNumber === '58000')!.debitCents).toBe(80000);
    expect(warnings.some((w) => w.toLowerCase().includes('not chart-of-accounts'))).toBe(true);
    expect(dr(entry!.lines)).toBe(cr(entry!.lines));
  });

  it('falls back to default expense when coded lines exceed the total', () => {
    const { entry, warnings } = buildApInvoiceJournalEntry(
      inv({
        totalCents: 50000,
        lineItems: [
          { description: 'X', quantity: 1, unitPriceCents: 90000, lineTotalCents: 90000, glCode: '52000' },
        ],
      }),
      ACCT,
    );
    expect(entry!.lines.find((l) => l.accountNumber === '58000')!.debitCents).toBe(50000);
    expect(warnings.some((w) => w.includes('exceed'))).toBe(true);
    expect(dr(entry!.lines)).toBe(cr(entry!.lines));
  });

  it('returns null for a zero-total bill', () => {
    const { entry } = buildApInvoiceJournalEntry(inv({ totalCents: 0 }), ACCT);
    expect(entry).toBeNull();
  });

  it('every line is a debit XOR a credit', () => {
    const { entry } = buildApInvoiceJournalEntry(
      inv({ totalCents: 88000, lineItems: [{ description: 'M', quantity: 1, unitPriceCents: 80000, lineTotalCents: 80000, glCode: '52000' }] }),
      ACCT,
    );
    for (const l of entry!.lines) expect((l.debitCents > 0) !== (l.creditCents > 0)).toBe(true);
  });
});
