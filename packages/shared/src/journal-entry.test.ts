import { describe, expect, it } from 'vitest';
import {
  JournalEntryCreateSchema,
  JournalEntrySchema,
  computeAccountBalances,
  computeJournalEntryRollup,
  isBalanced,
  totalCreditCents,
  totalDebitCents,
  type JournalEntry,
  type JournalEntryLine,
} from './journal-entry';

function jeCreate(over: Partial<{ memo: string; lines: JournalEntryLine[]; status: string }> = {}) {
  return {
    entryDate: '2026-04-25',
    memo: over.memo ?? 'Test entry',
    source: 'MANUAL' as const,
    status: (over.status ?? 'POSTED') as 'POSTED',
    lines: over.lines ?? [
      { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
      { accountNumber: '40100', debitCents: 0, creditCents: 50_000_00 },
    ],
  };
}

function fullJe(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'je-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    entryDate: '2026-04-25',
    memo: 'Test',
    source: 'MANUAL',
    status: 'POSTED',
    lines: [
      { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
      { accountNumber: '40100', debitCents: 0, creditCents: 50_000_00 },
    ],
    ...over,
  } as JournalEntry;
}

describe('JournalEntryCreateSchema balance enforcement', () => {
  it('accepts a balanced 2-line entry', () => {
    const r = JournalEntryCreateSchema.safeParse(jeCreate());
    expect(r.success).toBe(true);
  });

  it('rejects an entry where debits != credits', () => {
    const r = JournalEntryCreateSchema.safeParse(
      jeCreate({
        lines: [
          { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 49_000_00 },
        ],
      }),
    );
    expect(r.success).toBe(false);
  });

  it('rejects a single-line entry (min 2)', () => {
    const r = JournalEntryCreateSchema.safeParse(
      jeCreate({
        lines: [{ accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 }],
      }),
    );
    expect(r.success).toBe(false);
  });

  it('rejects a line that is both debit + credit', () => {
    const r = JournalEntryCreateSchema.safeParse(
      jeCreate({
        lines: [
          { accountNumber: '10100', debitCents: 100, creditCents: 100 },
          { accountNumber: '40100', debitCents: 0, creditCents: 100 },
        ],
      }),
    );
    expect(r.success).toBe(false);
  });

  it('rejects a line that is neither debit nor credit', () => {
    const r = JournalEntryCreateSchema.safeParse(
      jeCreate({
        lines: [
          { accountNumber: '10100', debitCents: 0, creditCents: 0 },
          { accountNumber: '40100', debitCents: 100, creditCents: 0 },
          { accountNumber: '40200', debitCents: 0, creditCents: 100 },
        ],
      }),
    );
    expect(r.success).toBe(false);
  });

  it('accepts a balanced multi-line split (3+ lines)', () => {
    const r = JournalEntryCreateSchema.safeParse(
      jeCreate({
        lines: [
          { accountNumber: '52000', debitCents: 30_000_00, creditCents: 0 },
          { accountNumber: '53100', debitCents: 20_000_00, creditCents: 0 },
          { accountNumber: '20100', debitCents: 0, creditCents: 50_000_00 },
        ],
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe('totalDebitCents / totalCreditCents / isBalanced', () => {
  it('sums the right side of each line', () => {
    const je = fullJe({
      lines: [
        { accountNumber: '52000', debitCents: 30_000_00, creditCents: 0 },
        { accountNumber: '53100', debitCents: 20_000_00, creditCents: 0 },
        { accountNumber: '20100', debitCents: 0, creditCents: 50_000_00 },
      ],
    });
    expect(totalDebitCents(je)).toBe(50_000_00);
    expect(totalCreditCents(je)).toBe(50_000_00);
    expect(isBalanced(je)).toBe(true);
  });
});

describe('computeAccountBalances', () => {
  it('only counts POSTED entries (skips drafts + voided)', () => {
    const balances = computeAccountBalances([
      fullJe({
        id: 'je-1',
        status: 'POSTED',
        lines: [
          { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 50_000_00 },
        ],
      }),
      fullJe({
        id: 'je-2',
        status: 'DRAFT',
        lines: [
          { accountNumber: '10100', debitCents: 99_999_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 99_999_00 },
        ],
      }),
      fullJe({
        id: 'je-3',
        status: 'VOIDED',
        lines: [
          { accountNumber: '10100', debitCents: 8_888_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 8_888_00 },
        ],
      }),
    ]);
    const cash = balances.find((b) => b.accountNumber === '10100');
    expect(cash?.debitCents).toBe(50_000_00);
    expect(cash?.balanceCents).toBe(50_000_00);
  });

  it('sums posted entries across the same account', () => {
    const balances = computeAccountBalances([
      fullJe({
        id: 'je-1',
        lines: [
          { accountNumber: '10100', debitCents: 30_000_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 30_000_00 },
        ],
      }),
      fullJe({
        id: 'je-2',
        lines: [
          { accountNumber: '10100', debitCents: 20_000_00, creditCents: 0 },
          { accountNumber: '40100', debitCents: 0, creditCents: 20_000_00 },
        ],
      }),
    ]);
    const cash = balances.find((b) => b.accountNumber === '10100');
    expect(cash?.debitCents).toBe(50_000_00);
    expect(cash?.creditCents).toBe(0);
  });

  it('aggregate trial balance balances to zero across all accounts', () => {
    const balances = computeAccountBalances([
      fullJe({
        id: 'je-1',
        lines: [
          { accountNumber: '52000', debitCents: 30_000_00, creditCents: 0 },
          { accountNumber: '53100', debitCents: 20_000_00, creditCents: 0 },
          { accountNumber: '20100', debitCents: 0, creditCents: 50_000_00 },
        ],
      }),
    ]);
    const totalDebit = balances.reduce((sum, b) => sum + b.debitCents, 0);
    const totalCredit = balances.reduce((sum, b) => sum + b.creditCents, 0);
    expect(totalDebit).toBe(totalCredit);
  });
});

describe('computeJournalEntryRollup', () => {
  it('counts by status and sums posted debits', () => {
    const r = computeJournalEntryRollup([
      fullJe({ id: 'je-1', status: 'POSTED' }),
      fullJe({ id: 'je-2', status: 'POSTED' }),
      fullJe({ id: 'je-3', status: 'DRAFT' }),
      fullJe({ id: 'je-4', status: 'VOIDED' }),
    ]);
    expect(r.total).toBe(4);
    expect(r.posted).toBe(2);
    expect(r.draft).toBe(1);
    expect(r.voided).toBe(1);
    expect(r.postedDebitCents).toBe(100_000_00);
  });
});
