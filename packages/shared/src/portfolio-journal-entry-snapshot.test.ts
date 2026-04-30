import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildPortfolioJournalEntrySnapshot } from './portfolio-journal-entry-snapshot';

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-1',
    createdAt: '',
    updatedAt: '',
    entryDate: '2026-04-15',
    memo: 'Test',
    source: 'MANUAL',
    status: 'POSTED',
    lines: [
      { accountNumber: '1010', debitCents: 100_00, creditCents: 0 },
      { accountNumber: '4010', debitCents: 0, creditCents: 100_00 },
    ],
    ...over,
  } as JournalEntry;
}

describe('buildPortfolioJournalEntrySnapshot', () => {
  it('counts entries + ytd', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      journalEntries: [
        je({ id: 'a', entryDate: '2025-04-15' }),
        je({ id: 'b', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.totalEntries).toBe(2);
    expect(r.ytdEntries).toBe(1);
  });

  it('separates posted, draft, voided', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'DRAFT' }),
        je({ id: 'c', status: 'VOIDED' }),
      ],
    });
    expect(r.postedEntries).toBe(1);
    expect(r.draftEntries).toBe(1);
    expect(r.voidedEntries).toBe(1);
  });

  it('sums posted debits + credits only', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      journalEntries: [
        je({
          id: 'a',
          status: 'POSTED',
          lines: [
            { accountNumber: '1010', debitCents: 200_00, creditCents: 0 },
            { accountNumber: '4010', debitCents: 0, creditCents: 200_00 },
          ],
        }),
        je({
          id: 'b',
          status: 'DRAFT',
          lines: [
            { accountNumber: '1010', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '4010', debitCents: 0, creditCents: 50_00 },
          ],
        }),
      ],
    });
    expect(r.postedDebitCents).toBe(200_00);
    expect(r.postedCreditCents).toBe(200_00);
  });

  it('breaks down by source + status', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE', status: 'POSTED' }),
        je({ id: 'b', source: 'PAYROLL', status: 'DRAFT' }),
      ],
    });
    expect(r.bySource.AP_INVOICE).toBe(1);
    expect(r.bySource.PAYROLL).toBe(1);
    expect(r.byStatus.POSTED).toBe(1);
    expect(r.byStatus.DRAFT).toBe(1);
  });

  it('counts distinct jobs from lines', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '1010', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '4010', debitCents: 0, creditCents: 100_00, jobId: 'j2' },
          ],
        }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores entries after asOf', () => {
    const r = buildPortfolioJournalEntrySnapshot({
      asOf: '2026-04-30',
      journalEntries: [je({ id: 'late', entryDate: '2026-05-15' })],
    });
    expect(r.totalEntries).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioJournalEntrySnapshot({ journalEntries: [] });
    expect(r.totalEntries).toBe(0);
  });
});
