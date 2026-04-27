import { describe, expect, it } from 'vitest';
import {
  buildIncomeStatement,
  grossProfitMargin,
  netProfitMargin,
} from './income-statement';
import type { Account } from './coa';
import type { JournalEntry } from './journal-entry';

function acc(over: Partial<Account>): Account {
  return {
    id: 'acc-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    number: '40100',
    name: 'Contract Revenue',
    type: 'REVENUE',
    active: true,
    ...over,
  } as Account;
}

function je(over: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'je-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    entryDate: '2026-04-15',
    memo: 'Test',
    source: 'MANUAL',
    status: 'POSTED',
    lines: [],
    ...over,
  } as JournalEntry;
}

const ACCOUNTS: Account[] = [
  acc({ id: 'a-1', number: '10100', name: 'Cash', type: 'ASSET' }),
  acc({ id: 'a-2', number: '40100', name: 'Contract Revenue', type: 'REVENUE' }),
  acc({ id: 'a-3', number: '52000', name: 'Materials', type: 'COGS' }),
  acc({ id: 'a-4', number: '53100', name: 'Equipment Rented', type: 'COGS' }),
  acc({ id: 'a-5', number: '62000', name: 'Office Rent', type: 'EXPENSE' }),
  acc({ id: 'a-6', number: '71000', name: 'Interest Income', type: 'OTHER_INCOME' }),
  acc({ id: 'a-7', number: '81000', name: 'Interest Expense', type: 'OTHER_EXPENSE' }),
];

describe('buildIncomeStatement', () => {
  it('rolls up revenue, COGS, GP, overhead, other, and net income', () => {
    const stmt = buildIncomeStatement({
      accounts: ACCOUNTS,
      entries: [
        // Revenue: $100,000
        je({
          id: 'je-1',
          entryDate: '2026-03-15',
          lines: [
            { accountNumber: '10100', debitCents: 100_000_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 100_000_00 },
          ],
        }),
        // COGS: $30,000 mat + $20,000 eqpt = $50,000
        je({
          id: 'je-2',
          entryDate: '2026-03-20',
          lines: [
            { accountNumber: '52000', debitCents: 30_000_00, creditCents: 0 },
            { accountNumber: '53100', debitCents: 20_000_00, creditCents: 0 },
            { accountNumber: '10100', debitCents: 0, creditCents: 50_000_00 },
          ],
        }),
        // Overhead: $5,000 rent
        je({
          id: 'je-3',
          entryDate: '2026-03-31',
          lines: [
            { accountNumber: '62000', debitCents: 5_000_00, creditCents: 0 },
            { accountNumber: '10100', debitCents: 0, creditCents: 5_000_00 },
          ],
        }),
        // Other: $200 interest income, $1,000 interest expense
        je({
          id: 'je-4',
          entryDate: '2026-04-01',
          lines: [
            { accountNumber: '10100', debitCents: 200_00, creditCents: 0 },
            { accountNumber: '71000', debitCents: 0, creditCents: 200_00 },
          ],
        }),
        je({
          id: 'je-5',
          entryDate: '2026-04-05',
          lines: [
            { accountNumber: '81000', debitCents: 1_000_00, creditCents: 0 },
            { accountNumber: '10100', debitCents: 0, creditCents: 1_000_00 },
          ],
        }),
      ],
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(stmt.revenue.totalCents).toBe(100_000_00);
    expect(stmt.cogs.totalCents).toBe(50_000_00);
    expect(stmt.grossProfitCents).toBe(50_000_00);
    expect(stmt.overhead.totalCents).toBe(5_000_00);
    expect(stmt.operatingIncomeCents).toBe(45_000_00);
    expect(stmt.otherIncome.totalCents).toBe(200_00);
    expect(stmt.otherExpense.totalCents).toBe(1_000_00);
    expect(stmt.netIncomeCents).toBe(44_200_00);
  });

  it('skips DRAFT and VOIDED entries', () => {
    const stmt = buildIncomeStatement({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          status: 'DRAFT',
          lines: [
            { accountNumber: '10100', debitCents: 99_999_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 99_999_00 },
          ],
        }),
        je({
          id: 'je-2',
          status: 'VOIDED',
          lines: [
            { accountNumber: '10100', debitCents: 8_888_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 8_888_00 },
          ],
        }),
      ],
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(stmt.revenue.totalCents).toBe(0);
  });

  it('only counts entries within [start, end] inclusive', () => {
    const stmt = buildIncomeStatement({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          entryDate: '2025-12-31',
          lines: [
            { accountNumber: '10100', debitCents: 99_999_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 99_999_00 },
          ],
        }),
        je({
          id: 'je-2',
          entryDate: '2026-01-01',
          lines: [
            { accountNumber: '10100', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 100_00 },
          ],
        }),
      ],
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(stmt.revenue.totalCents).toBe(100_00);
  });
});

describe('grossProfitMargin / netProfitMargin', () => {
  it('returns 0 when revenue is 0', () => {
    const stmt = buildIncomeStatement({
      accounts: ACCOUNTS,
      entries: [],
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(grossProfitMargin(stmt)).toBe(0);
    expect(netProfitMargin(stmt)).toBe(0);
  });

  it('computes the right ratios', () => {
    const stmt = buildIncomeStatement({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          lines: [
            { accountNumber: '10100', debitCents: 100_000_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 100_000_00 },
          ],
        }),
        je({
          id: 'je-2',
          lines: [
            { accountNumber: '52000', debitCents: 60_000_00, creditCents: 0 },
            { accountNumber: '10100', debitCents: 0, creditCents: 60_000_00 },
          ],
        }),
      ],
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(grossProfitMargin(stmt)).toBeCloseTo(0.4, 5);
    expect(netProfitMargin(stmt)).toBeCloseTo(0.4, 5);
  });
});
