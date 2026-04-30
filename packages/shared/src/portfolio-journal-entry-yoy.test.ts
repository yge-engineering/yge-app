import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildPortfolioJournalEntryYoy } from './portfolio-journal-entry-yoy';

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

describe('buildPortfolioJournalEntryYoy', () => {
  it('compares prior vs current totals + status mix', () => {
    const r = buildPortfolioJournalEntryYoy({
      currentYear: 2026,
      journalEntries: [
        je({ id: 'a', entryDate: '2025-04-15', status: 'POSTED' }),
        je({ id: 'b', entryDate: '2026-04-15', status: 'POSTED' }),
        je({ id: 'c', entryDate: '2026-04-16', status: 'DRAFT' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentPosted).toBe(1);
    expect(r.currentDraft).toBe(1);
  });

  it('sums debit + credit only on POSTED', () => {
    const r = buildPortfolioJournalEntryYoy({
      currentYear: 2026,
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'DRAFT' }),
      ],
    });
    expect(r.currentTotalDebitCents).toBe(100_00);
    expect(r.currentTotalCreditCents).toBe(100_00);
  });

  it('counts distinct sources + accounts', () => {
    const r = buildPortfolioJournalEntryYoy({
      currentYear: 2026,
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE' }),
        je({ id: 'b', source: 'AR_INVOICE' }),
      ],
    });
    expect(r.currentDistinctSources).toBe(2);
    expect(r.currentDistinctAccounts).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioJournalEntryYoy({ currentYear: 2026, journalEntries: [] });
    expect(r.currentTotal).toBe(0);
  });
});
