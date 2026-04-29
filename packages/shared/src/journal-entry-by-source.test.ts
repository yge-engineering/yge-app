import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildJournalEntryBySource } from './journal-entry-by-source';

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
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

describe('buildJournalEntryBySource', () => {
  it('groups JEs by source', () => {
    const r = buildJournalEntryBySource({
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE' }),
        je({ id: 'b', source: 'AP_INVOICE' }),
        je({ id: 'c', source: 'MANUAL' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const ap = r.rows.find((x) => x.source === 'AP_INVOICE');
    expect(ap?.count).toBe(2);
  });

  it('counts each status separately per source', () => {
    const r = buildJournalEntryBySource({
      journalEntries: [
        je({ id: 'p', status: 'POSTED' }),
        je({ id: 'd', status: 'DRAFT' }),
        je({ id: 'v', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.posted).toBe(1);
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.voided).toBe(1);
  });

  it('sums total debit/credit', () => {
    const r = buildJournalEntryBySource({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '1010', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '4010', debitCents: 0, creditCents: 100_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalDebitCents).toBe(100_00);
    expect(r.rows[0]?.totalCreditCents).toBe(100_00);
  });

  it('computes share over POSTED only', () => {
    const r = buildJournalEntryBySource({
      journalEntries: [
        je({ id: 'a', source: 'MANUAL', status: 'POSTED' }),
        je({ id: 'b', source: 'AP_INVOICE', status: 'POSTED' }),
        je({ id: 'c', source: 'AP_INVOICE', status: 'POSTED' }),
        je({ id: 'd', source: 'AP_INVOICE', status: 'DRAFT' }),
      ],
    });
    const ap = r.rows.find((x) => x.source === 'AP_INVOICE');
    expect(ap?.share).toBeCloseTo(0.6667, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJournalEntryBySource({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      journalEntries: [
        je({ id: 'old', entryDate: '2026-03-15' }),
        je({ id: 'in', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by count desc', () => {
    const r = buildJournalEntryBySource({
      journalEntries: [
        je({ id: 'a', source: 'MANUAL' }),
        je({ id: 'b', source: 'AP_INVOICE' }),
        je({ id: 'c', source: 'AP_INVOICE' }),
        je({ id: 'd', source: 'AP_INVOICE' }),
      ],
    });
    expect(r.rows[0]?.source).toBe('AP_INVOICE');
  });

  it('handles empty input', () => {
    const r = buildJournalEntryBySource({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
