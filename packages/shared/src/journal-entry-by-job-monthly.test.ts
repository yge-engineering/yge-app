import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildJournalEntryByJobMonthly } from './journal-entry-by-job-monthly';

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    entryDate: '2026-04-15',
    memo: 'Test',
    source: 'AP_INVOICE',
    status: 'POSTED',
    lines: [
      { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
      { accountNumber: '2000', debitCents: 0, creditCents: 100_00 },
    ],
    ...over,
  } as JournalEntry;
}

describe('buildJournalEntryByJobMonthly', () => {
  it('groups lines by (job, month)', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({
          id: 'a',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '2000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
        je({
          id: 'b',
          entryDate: '2026-05-01',
          lines: [
            { accountNumber: '5000', debitCents: 50_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '2000', debitCents: 0, creditCents: 50_00 },
          ],
        }),
        je({
          id: 'c',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '5000', debitCents: 30_00, creditCents: 0, jobId: 'j2' },
            { accountNumber: '2000', debitCents: 0, creditCents: 30_00 },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums debits + credits + net per (job, month)', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '5100', debitCents: 50_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '2000', debitCents: 0, creditCents: 150_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.debitCents).toBe(150_00);
    expect(r.rows[0]?.netCents).toBe(150_00);
    expect(r.rows[0]?.lines).toBe(2);
  });

  it('counts distinct entries + accounts', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '5100', debitCents: 50_00, creditCents: 0, jobId: 'j1' },
          ],
        }),
        je({
          id: 'b',
          lines: [
            { accountNumber: '5000', debitCents: 25_00, creditCents: 0, jobId: 'j1' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.distinctEntries).toBe(2);
    expect(r.rows[0]?.distinctAccounts).toBe(2);
  });

  it('counts unattributed lines (no jobId)', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'j1' },
            { accountNumber: '2000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rollup.totalLines).toBe(1);
  });

  it('skips DRAFT and VOIDED entries', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({ id: 'a', status: 'POSTED' }),
        je({ id: 'b', status: 'DRAFT' }),
        je({ id: 'c', status: 'VOIDED' }),
      ],
    });
    expect(r.rollup.draftSkipped).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJournalEntryByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      journalEntries: [
        je({ id: 'old', entryDate: '2026-03-15' }),
        je({ id: 'in', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1); // only April line counts
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJournalEntryByJobMonthly({
      journalEntries: [
        je({
          id: 'a',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '5000', debitCents: 100_00, creditCents: 0, jobId: 'Z' },
            { accountNumber: '2000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
        je({
          id: 'b',
          entryDate: '2026-05-01',
          lines: [
            { accountNumber: '5000', debitCents: 50_00, creditCents: 0, jobId: 'A' },
            { accountNumber: '2000', debitCents: 0, creditCents: 50_00 },
          ],
        }),
        je({
          id: 'c',
          entryDate: '2026-04-15',
          lines: [
            { accountNumber: '5000', debitCents: 75_00, creditCents: 0, jobId: 'A' },
            { accountNumber: '2000', debitCents: 0, creditCents: 75_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJournalEntryByJobMonthly({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalLines).toBe(0);
  });
});
