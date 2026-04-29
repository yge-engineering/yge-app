import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildPortfolioJournalEntryMonthly } from './portfolio-journal-entry-monthly';

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-1',
    createdAt: '',
    updatedAt: '',
    entryDate: '2026-04-15',
    memo: 'Test',
    source: 'AP_INVOICE',
    status: 'POSTED',
    lines: [
      { accountNumber: '5000', debitCents: 100_00, creditCents: 0 },
      { accountNumber: '2000', debitCents: 0, creditCents: 100_00 },
    ],
    ...over,
  } as JournalEntry;
}

describe('buildPortfolioJournalEntryMonthly', () => {
  it('counts by status', () => {
    const r = buildPortfolioJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'POSTED' }),
        je({ id: 'c', status: 'DRAFT' }),
        je({ id: 'd', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.posted).toBe(2);
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.voided).toBe(1);
  });

  it('sums debit + credit only on POSTED', () => {
    const r = buildPortfolioJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'DRAFT' }),
      ],
    });
    expect(r.rows[0]?.totalDebitCents).toBe(100_00);
    expect(r.rows[0]?.totalCreditCents).toBe(100_00);
  });

  it('counts distinct sources + accounts', () => {
    const r = buildPortfolioJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE' }),
        je({ id: 'b', source: 'AR_INVOICE' }),
      ],
    });
    expect(r.rows[0]?.distinctSources).toBe(2);
    expect(r.rows[0]?.distinctAccounts).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioJournalEntryMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      journalEntries: [
        je({ id: 'old', entryDate: '2026-03-15' }),
        je({ id: 'in', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', entryDate: '2026-06-15' }),
        je({ id: 'b', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioJournalEntryMonthly({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
