import { describe, expect, it } from 'vitest';
import {
  buildQboTrialBalanceImport,
  tbRowsFromCsv,
  OPENING_BALANCE_EQUITY_NUMBER,
} from './qbo-trial-balance-import';
import type { Account } from './coa';

function acct(number: string, name: string, type: Account['type']): Account {
  return {
    id: `acc-${number}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    number,
    name,
    type,
    active: true,
  };
}

const COA: Account[] = [
  acct('10000', 'Checking', 'ASSET'),
  acct('12000', 'Accounts Receivable', 'ASSET'),
  acct('20000', 'Accounts Payable', 'LIABILITY'),
  acct('32000', 'Retained Earnings', 'EQUITY'),
];

describe('tbRowsFromCsv', () => {
  it('parses Account/Debit/Credit and skips the total line', () => {
    const csv =
      'Account,Debit,Credit\n' +
      '10000 Checking,"50,000.00",\n' +
      '20000 Accounts Payable,,"10,000.00"\n' +
      'TOTAL,"50,000.00","50,000.00"\n';
    const rows = tbRowsFromCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ accountRef: '10000 Checking', debit: '50,000.00' });
  });
});

describe('buildQboTrialBalanceImport', () => {
  const opts = { entryDate: '2026-01-01' };

  it('builds a balanced entry from matched accounts', () => {
    const rows = [
      { accountRef: '10000 Checking', debit: '50000.00', credit: '' },
      { accountRef: '12000 Accounts Receivable', debit: '20000.00', credit: '' },
      { accountRef: '20000 Accounts Payable', debit: '', credit: '15000.00' },
      { accountRef: '32000 Retained Earnings', debit: '', credit: '55000.00' },
    ];
    const res = buildQboTrialBalanceImport(rows, COA, opts);
    expect(res.entry).not.toBeNull();
    expect(res.totalDebitCents).toBe(res.totalCreditCents);
    expect(res.totalDebitCents).toBe(7000000);
    expect(res.plugNetDebitCents).toBe(0);
    expect(res.unmatched).toHaveLength(0);
    // Every line is a debit XOR a credit.
    for (const l of res.entry!.lines) {
      expect((l.debitCents > 0) !== (l.creditCents > 0)).toBe(true);
    }
  });

  it('matches by name when no leading number is present', () => {
    const rows = [
      { accountRef: 'Checking', debit: '100.00', credit: '' },
      { accountRef: 'Retained Earnings', debit: '', credit: '100.00' },
    ];
    const res = buildQboTrialBalanceImport(rows, COA, opts);
    expect(res.unmatched).toHaveLength(0);
    expect(res.matched.find((m) => m.accountNumber === '10000')!.debitCents).toBe(10000);
  });

  it('plugs unmatched balances into Opening Balance Equity and stays balanced', () => {
    const rows = [
      { accountRef: '10000 Checking', debit: '1000.00', credit: '' },
      { accountRef: '99999 Mystery Account', debit: '', credit: '1000.00' },
    ];
    const res = buildQboTrialBalanceImport(rows, COA, opts);
    expect(res.unmatched).toHaveLength(1);
    // matched net debit = +1000.00 (checking); plug = -1000.00 -> credit to OBE.
    expect(res.plugNetDebitCents).toBe(-100000);
    const obe = res.matched.find((m) => m.accountNumber === OPENING_BALANCE_EQUITY_NUMBER);
    expect(obe).toBeDefined();
    expect(obe!.creditCents).toBe(100000);
    expect(res.totalDebitCents).toBe(res.totalCreditCents);
  });

  it('returns a null entry when no account carries a net balance', () => {
    const rows = [{ accountRef: '10000 Checking', debit: '100.00', credit: '100.00' }];
    const res = buildQboTrialBalanceImport(rows, COA, opts);
    expect(res.entry).toBeNull();
  });

  it('honors a custom memo + entry date', () => {
    const rows = [
      { accountRef: '10000 Checking', debit: '100.00', credit: '' },
      { accountRef: '32000 Retained Earnings', debit: '', credit: '100.00' },
    ];
    const res = buildQboTrialBalanceImport(rows, COA, {
      entryDate: '2026-03-31',
      memo: 'Cutover',
    });
    expect(res.entry!.entryDate).toBe('2026-03-31');
    expect(res.entry!.memo).toBe('Cutover');
  });
});
