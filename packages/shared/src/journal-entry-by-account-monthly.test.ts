import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildJournalEntryByAccountMonthly } from './journal-entry-by-account-monthly';

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    entryDate: '2026-04-15',
    memo: 'Test',
    source: 'MANUAL',
    status: 'POSTED',
    lines: [
      { accountNumber: '1000', debitCents: 100_00, creditCents: 0 },
      { accountNumber: '4000', debitCents: 0, creditCents: 100_00 },
    ],
    ...over,
  } as JournalEntry;
}

describe('buildJournalEntryByAccountMonthly', () => {
  it('groups by (account, month)', () => {
    const r = buildJournalEntryByAccountMonthly({
      journalEntries: [
        je({
          id: 'a',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '1000', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '4000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
        je({
          id: 'b',
          entryDate: '2026-05-01',
          lines: [
            { accountNumber: '1000', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '4000', debitCents: 0, creditCents: 50_00 },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(4);
  });

  it('sums debits and credits per (account, month)', () => {
    const r = buildJournalEntryByAccountMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '1000', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '1000', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '4000', debitCents: 0, creditCents: 150_00 },
          ],
        }),
      ],
    });
    const cash = r.rows.find((x) => x.accountNumber === '1000');
    expect(cash?.debitCents).toBe(150_00);
    expect(cash?.netCents).toBe(150_00);
  });

  it('skips DRAFT and VOIDED entries', () => {
    const r = buildJournalEntryByAccountMonthly({
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'DRAFT' }),
        je({ id: 'c', status: 'VOIDED' }),
      ],
    });
    expect(r.rollup.draftSkipped).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
    expect(r.rollup.totalLines).toBe(2); // POSTED entry has 2 lines
  });

  it('counts distinct entries + jobs', () => {
    const r = buildJournalEntryByAccountMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '1000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '1000', debitCents: 50_00, creditCents: 0, jobId: 'j2' },
          ],
        }),
        je({
          id: 'b',
          lines: [
            { accountNumber: '1000', debitCents: 25_00, creditCents: 0, jobId: 'j1' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.distinctEntries).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJournalEntryByAccountMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      journalEntries: [
        je({ id: 'old', entryDate: '2026-03-15' }),
        je({ id: 'in', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(2); // only 'in' counts
  });

  it('sorts by accountNumber asc, month asc', () => {
    const r = buildJournalEntryByAccountMonthly({
      journalEntries: [
        je({
          id: 'a',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '1000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
        je({
          id: 'b',
          entryDate: '2026-05-01',
          lines: [
            { accountNumber: '1000', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '5000', debitCents: 0, creditCents: 50_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.accountNumber).toBe('1000');
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('handles empty input', () => {
    const r = buildJournalEntryByAccountMonthly({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalLines).toBe(0);
  });
});
