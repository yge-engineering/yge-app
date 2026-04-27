import { describe, expect, it } from 'vitest';
import { buildBalanceSheet } from './balance-sheet';
import type { Account } from './coa';
import type { JournalEntry } from './journal-entry';

function acc(over: Partial<Account>): Account {
  return {
    id: 'acc-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    number: '10100',
    name: 'Cash',
    type: 'ASSET',
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
  acc({ id: 'a-2', number: '11000', name: 'AR', type: 'ASSET' }),
  acc({ id: 'a-3', number: '20100', name: 'AP', type: 'LIABILITY' }),
  acc({ id: 'a-4', number: '30000', name: 'Common Stock', type: 'EQUITY' }),
  acc({ id: 'a-5', number: '40100', name: 'Revenue', type: 'REVENUE' }),
  acc({ id: 'a-6', number: '52000', name: 'Materials', type: 'COGS' }),
  acc({ id: 'a-7', number: '62000', name: 'Office Rent', type: 'EXPENSE' }),
];

describe('buildBalanceSheet', () => {
  it('balances after a stock issuance — Cash debited, Common Stock credited', () => {
    const sheet = buildBalanceSheet({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          lines: [
            { accountNumber: '10100', debitCents: 100_000_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 100_000_00 },
          ],
        }),
      ],
      asOf: '2026-12-31',
    });
    expect(sheet.assets.totalCents).toBe(100_000_00);
    expect(sheet.equity.totalCents).toBe(100_000_00);
    expect(sheet.currentPeriodEarningsCents).toBe(0);
    expect(sheet.inBalance).toBe(true);
  });

  it('flows revenue + COGS through to current-period earnings and stays balanced', () => {
    const sheet = buildBalanceSheet({
      accounts: ACCOUNTS,
      entries: [
        // Stock issued for $50k cash
        je({
          id: 'je-1',
          lines: [
            { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 50_000_00 },
          ],
        }),
        // $80k of work billed (AR up, revenue up)
        je({
          id: 'je-2',
          lines: [
            { accountNumber: '11000', debitCents: 80_000_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 80_000_00 },
          ],
        }),
        // $30k materials bought on account (COGS up, AP up)
        je({
          id: 'je-3',
          lines: [
            { accountNumber: '52000', debitCents: 30_000_00, creditCents: 0 },
            { accountNumber: '20100', debitCents: 0, creditCents: 30_000_00 },
          ],
        }),
      ],
      asOf: '2026-12-31',
    });
    // Assets = $50k cash + $80k AR = $130k
    expect(sheet.assets.totalCents).toBe(130_000_00);
    // Liabilities = $30k AP
    expect(sheet.liabilities.totalCents).toBe(30_000_00);
    // Equity (stock) = $50k
    expect(sheet.equity.totalCents).toBe(50_000_00);
    // Current period earnings = $80k − $30k = $50k
    expect(sheet.currentPeriodEarningsCents).toBe(50_000_00);
    // Total L + E + retained = $30k + $50k + $50k = $130k = Assets ✓
    expect(sheet.totalLiabilitiesAndEquityCents).toBe(130_000_00);
    expect(sheet.inBalance).toBe(true);
  });

  it('skips entries past asOf', () => {
    const sheet = buildBalanceSheet({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          entryDate: '2026-06-15',
          lines: [
            { accountNumber: '10100', debitCents: 99_999_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 99_999_00 },
          ],
        }),
      ],
      asOf: '2026-04-30',
    });
    expect(sheet.assets.totalCents).toBe(0);
    expect(sheet.inBalance).toBe(true);
  });

  it('skips DRAFT and VOIDED entries', () => {
    const sheet = buildBalanceSheet({
      accounts: ACCOUNTS,
      entries: [
        je({
          id: 'je-1',
          status: 'DRAFT',
          lines: [
            { accountNumber: '10100', debitCents: 99_999_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 99_999_00 },
          ],
        }),
        je({
          id: 'je-2',
          status: 'VOIDED',
          lines: [
            { accountNumber: '10100', debitCents: 8_888_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 8_888_00 },
          ],
        }),
      ],
      asOf: '2026-12-31',
    });
    expect(sheet.assets.totalCents).toBe(0);
    expect(sheet.equity.totalCents).toBe(0);
  });

  it('balances even when net income is negative (expenses exceed revenue)', () => {
    const sheet = buildBalanceSheet({
      accounts: ACCOUNTS,
      entries: [
        // Stock issued for $50k cash
        je({
          id: 'je-1',
          lines: [
            { accountNumber: '10100', debitCents: 50_000_00, creditCents: 0 },
            { accountNumber: '30000', debitCents: 0, creditCents: 50_000_00 },
          ],
        }),
        // $20k overhead paid in cash
        je({
          id: 'je-2',
          lines: [
            { accountNumber: '62000', debitCents: 20_000_00, creditCents: 0 },
            { accountNumber: '10100', debitCents: 0, creditCents: 20_000_00 },
          ],
        }),
      ],
      asOf: '2026-12-31',
    });
    expect(sheet.assets.totalCents).toBe(30_000_00); // $50k − $20k
    expect(sheet.equity.totalCents).toBe(50_000_00);
    expect(sheet.currentPeriodEarningsCents).toBe(-20_000_00);
    expect(sheet.totalLiabilitiesAndEquityCents).toBe(30_000_00);
    expect(sheet.inBalance).toBe(true);
  });
});
