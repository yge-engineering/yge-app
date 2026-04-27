import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COA_SEED,
  computeCoaRollup,
  defaultTypeForNumber,
  normalBalanceFor,
  type Account,
} from './coa';

function acc(over: Partial<Account>): Account {
  return {
    id: 'acc-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    number: '10100',
    name: 'Operating Cash',
    type: 'ASSET',
    active: true,
    ...over,
  } as Account;
}

describe('normalBalanceFor', () => {
  it('returns DEBIT for asset / cogs / expense', () => {
    expect(normalBalanceFor('ASSET')).toBe('DEBIT');
    expect(normalBalanceFor('COGS')).toBe('DEBIT');
    expect(normalBalanceFor('EXPENSE')).toBe('DEBIT');
    expect(normalBalanceFor('OTHER_EXPENSE')).toBe('DEBIT');
  });
  it('returns CREDIT for liability / equity / revenue', () => {
    expect(normalBalanceFor('LIABILITY')).toBe('CREDIT');
    expect(normalBalanceFor('EQUITY')).toBe('CREDIT');
    expect(normalBalanceFor('REVENUE')).toBe('CREDIT');
    expect(normalBalanceFor('OTHER_INCOME')).toBe('CREDIT');
  });
});

describe('defaultTypeForNumber', () => {
  it('infers type from leading digit', () => {
    expect(defaultTypeForNumber('10100')).toBe('ASSET');
    expect(defaultTypeForNumber('20100')).toBe('LIABILITY');
    expect(defaultTypeForNumber('30000')).toBe('EQUITY');
    expect(defaultTypeForNumber('40100')).toBe('REVENUE');
    expect(defaultTypeForNumber('51100')).toBe('COGS');
    expect(defaultTypeForNumber('61000')).toBe('EXPENSE');
    expect(defaultTypeForNumber('71000')).toBe('OTHER_INCOME');
    expect(defaultTypeForNumber('81000')).toBe('OTHER_EXPENSE');
  });
});

describe('computeCoaRollup', () => {
  it('counts active vs inactive', () => {
    const r = computeCoaRollup([
      acc({ id: 'acc-1', active: true }),
      acc({ id: 'acc-2', active: true }),
      acc({ id: 'acc-3', active: false }),
    ]);
    expect(r.total).toBe(3);
    expect(r.active).toBe(2);
    expect(r.inactive).toBe(1);
  });
});

describe('DEFAULT_COA_SEED', () => {
  it('has unique account numbers', () => {
    const numbers = DEFAULT_COA_SEED.map((s) => s.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
  it('every parentNumber points to a real account number in the seed', () => {
    const numbers = new Set(DEFAULT_COA_SEED.map((s) => s.number));
    for (const seed of DEFAULT_COA_SEED) {
      if (seed.parentNumber) {
        expect(numbers.has(seed.parentNumber)).toBe(true);
      }
    }
  });
  it('every account number type matches its leading-digit default', () => {
    for (const seed of DEFAULT_COA_SEED) {
      expect(seed.type).toBe(defaultTypeForNumber(seed.number));
    }
  });
});
