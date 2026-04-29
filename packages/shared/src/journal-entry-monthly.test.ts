import { describe, expect, it } from 'vitest';

import type { JournalEntry } from './journal-entry';

import { buildJournalEntryMonthly } from './journal-entry-monthly';

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

describe('buildJournalEntryMonthly', () => {
  it('buckets JEs by yyyy-mm of entryDate', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', entryDate: '2026-03-15' }),
        je({ id: 'b', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each status separately', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({ id: 'p', status: 'POSTED' }),
        je({ id: 'p2', status: 'POSTED' }),
        je({ id: 'd', status: 'DRAFT' }),
        je({ id: 'v', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.posted).toBe(2);
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.voided).toBe(1);
    expect(r.rows[0]?.total).toBe(4);
  });

  it('sums total debit/credit across lines', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({
          id: 'a',
          lines: [
            { accountNumber: '1010', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '2010', debitCents: 50_00, creditCents: 0 },
            { accountNumber: '4010', debitCents: 0, creditCents: 150_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalDebitCents).toBe(150_00);
    expect(r.rows[0]?.totalCreditCents).toBe(150_00);
  });

  it('counts distinct sources per month', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({ id: 'a', source: 'AP_INVOICE' }),
        je({ id: 'b', source: 'AR_INVOICE' }),
        je({ id: 'c', source: 'AP_INVOICE' }),
      ],
    });
    expect(r.rows[0]?.distinctSources).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildJournalEntryMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      journalEntries: [
        je({ id: 'mar', entryDate: '2026-03-15' }),
        je({ id: 'apr', entryDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month count change', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({ id: 'mar', entryDate: '2026-03-15' }),
        je({ id: 'apr1', entryDate: '2026-04-10' }),
        je({ id: 'apr2', entryDate: '2026-04-15' }),
        je({ id: 'apr3', entryDate: '2026-04-20' }),
      ],
    });
    expect(r.rollup.monthOverMonthCountChange).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildJournalEntryMonthly({
      journalEntries: [
        je({ id: 'late', entryDate: '2026-04-15' }),
        je({ id: 'early', entryDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildJournalEntryMonthly({ journalEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
