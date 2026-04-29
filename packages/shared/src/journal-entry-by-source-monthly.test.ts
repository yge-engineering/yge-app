import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildJournalEntryBySourceMonthly } from './journal-entry-by-source-monthly';

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

describe('buildJournalEntryBySourceMonthly', () => {
  it('groups by (source, month)', () => {
    const r = buildJournalEntryBySourceMonthly({
      journalEntries: [
        je({ id: 'a', source: 'MANUAL', entryDate: '2026-04-15' }),
        je({ id: 'b', source: 'AP_INVOICE', entryDate: '2026-04-15' }),
        je({ id: 'c', source: 'MANUAL', entryDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts by status', () => {
    const r = buildJournalEntryBySourceMonthly({
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
    expect(r.rows[0]?.count).toBe(4);
  });

  it('sums debit + credit only on POSTED', () => {
    const r = buildJournalEntryBySourceMonthly({
      journalEntries: [
        je({
          id: 'a',
          status: 'POSTED',
          lines: [
            { accountNumber: '1000', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '4000', debitCents: 0, creditCents: 100_00 },
          ],
        }),
        je({
          id: 'b',
          status: 'DRAFT',
          lines: [
            { accountNumber: '1000', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '4000', debitCents: 0, creditCents: 50_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalDebitCents).toBe(100_00);
    expect(r.rows[0]?.totalCreditCents).toBe(100_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJournalEntryBySourceMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      journalEntries: [
        je({ id: 'old', entryDate: '2026-03-15' }),
        je({ id: 'in', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildJournalEntryBySourceMonthly({
      journalEntries: [
        je({ id: 'a', source: 'MANUAL' }),
        je({ id: 'b', source: 'AP_INVOICE' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(2);
    expect(r.rollup.totalDebitCents).toBe(200_00);
  });

  it('sorts by month asc, source asc within month', () => {
    const r = buildJournalEntryBySourceMonthly({
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE', entryDate: '2026-05-15' }),
        je({ id: 'b', source: 'AR_INVOICE', entryDate: '2026-04-15' }),
        je({ id: 'c', source: 'AP_INVOICE', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.source).toBe('AP_INVOICE');
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildJournalEntryBySourceMonthly({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalEntries).toBe(0);
  });
});
