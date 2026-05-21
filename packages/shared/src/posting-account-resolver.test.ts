import { describe, expect, it } from 'vitest';
import { resolvePostingAccounts } from './posting-account-resolver';
import type { Account } from './coa';

function acc(number: string, name: string, type: Account['type'], active = true): Account {
  return {
    id: `acc-${number}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    number,
    name,
    type,
    active,
  };
}

const SEED_LIKE: Account[] = [
  acc('11000', 'Accounts Receivable', 'ASSET'),
  acc('11100', 'AR — Retention Receivable', 'ASSET'),
  acc('20100', 'Accounts Payable', 'LIABILITY'),
  acc('20200', 'Retention Payable to Subs', 'LIABILITY'),
  acc('21300', 'Sales / Use Tax Payable', 'LIABILITY'),
  acc('40100', 'Contract Revenue — Lump Sum', 'REVENUE'),
  acc('40200', 'Contract Revenue — Unit Price', 'REVENUE'),
  acc('52000', 'Materials — Job', 'COGS'),
  acc('58000', 'Other Direct Job Cost', 'COGS'),
];

describe('resolvePostingAccounts', () => {
  it('resolves the seed-style chart of accounts', () => {
    const r = resolvePostingAccounts(SEED_LIKE);
    expect(r.arControl).toBe('11000');
    expect(r.arRetention).toBe('11100');
    expect(r.apControl).toBe('20100');
    expect(r.salesTax).toBe('21300');
    expect(r.revenue).toBe('40100');
    expect(r.defaultExpense).toBe('58000');
    expect(r.warnings).toEqual([]);
  });

  it('does not confuse retention with the AR / AP control accounts', () => {
    const r = resolvePostingAccounts(SEED_LIKE);
    expect(r.arControl).not.toBe('11100');
    expect(r.apControl).not.toBe('20200');
  });

  it('resolves QuickBooks-style numbers (different from the seed)', () => {
    const qbo: Account[] = [
      acc('10000', 'Accounts Receivable', 'ASSET'),
      acc('20000', 'Accounts Payable', 'LIABILITY'),
      acc('40000', 'Construction Income', 'REVENUE'),
      acc('50000', 'Job Materials', 'COGS'),
    ];
    const r = resolvePostingAccounts(qbo);
    expect(r.arControl).toBe('10000');
    expect(r.apControl).toBe('20000');
    expect(r.revenue).toBe('40000'); // first revenue account when no "Contract Revenue"
    expect(r.defaultExpense).toBe('50000');
    expect(r.arRetention).toBeUndefined();
    expect(r.salesTax).toBeUndefined();
  });

  it('falls back to seed defaults + warns when accounts are missing', () => {
    const r = resolvePostingAccounts([acc('30000', 'Common Stock', 'EQUITY')]);
    expect(r.arControl).toBe('11000');
    expect(r.apControl).toBe('20100');
    expect(r.revenue).toBe('40100');
    expect(r.defaultExpense).toBe('58000');
    expect(r.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('ignores inactive accounts', () => {
    const r = resolvePostingAccounts([
      acc('10000', 'Accounts Receivable', 'ASSET', false),
      acc('10500', 'Accounts Receivable - New', 'ASSET', true),
      acc('20100', 'Accounts Payable', 'LIABILITY'),
      acc('40100', 'Contract Revenue', 'REVENUE'),
      acc('58000', 'Other Direct Job Cost', 'COGS'),
    ]);
    expect(r.arControl).toBe('10500');
  });
});
