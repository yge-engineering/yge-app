import { describe, expect, it } from 'vitest';
import {
  computeExpenseRollup,
  defaultGlAccountForCategory,
  expenseReimbursableCents,
  type Expense,
} from './expense';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'exp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    employeeId: 'emp-aaaaaaaa',
    employeeName: 'Jane Doe',
    receiptDate: '2026-04-15',
    vendor: 'Holiday Inn',
    description: 'Lodging',
    amountCents: 250_00,
    category: 'LODGING',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('expenseReimbursableCents', () => {
  it('returns full amount for out-of-pocket', () => {
    expect(expenseReimbursableCents(exp({ amountCents: 250_00 }))).toBe(250_00);
  });

  it('returns 0 for company-card receipts', () => {
    expect(
      expenseReimbursableCents(exp({ amountCents: 250_00, paidWithCompanyCard: true })),
    ).toBe(0);
  });
});

describe('defaultGlAccountForCategory', () => {
  it('routes by category', () => {
    expect(defaultGlAccountForCategory('LODGING')).toBe('58000');
    expect(defaultGlAccountForCategory('FUEL')).toBe('53200');
    expect(defaultGlAccountForCategory('MATERIAL')).toBe('52000');
    expect(defaultGlAccountForCategory('TOOL_PURCHASE')).toBe('53300');
    expect(defaultGlAccountForCategory('PERMIT_FEE')).toBe('55000');
    expect(defaultGlAccountForCategory('AGENCY_FEE')).toBe('67000');
    expect(defaultGlAccountForCategory('OTHER')).toBe('69000');
  });
});

describe('computeExpenseRollup', () => {
  it('separates out-of-pocket from company-card and tracks owed', () => {
    const r = computeExpenseRollup([
      exp({ id: 'exp-1', amountCents: 250_00, paidWithCompanyCard: false, reimbursed: false }),
      exp({ id: 'exp-2', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: true }),
      exp({ id: 'exp-3', amountCents: 9_999_00, paidWithCompanyCard: true }),
    ]);
    expect(r.total).toBe(3);
    expect(r.totalCents).toBe(10_349_00);
    expect(r.reimbursableCents).toBe(350_00);
    expect(r.reimbursedCents).toBe(100_00);
    expect(r.outstandingCents).toBe(250_00);
  });

  it('rolls up by category sorted by spend', () => {
    const r = computeExpenseRollup([
      exp({ id: 'exp-1', category: 'LODGING', amountCents: 500_00 }),
      exp({ id: 'exp-2', category: 'LODGING', amountCents: 300_00 }),
      exp({ id: 'exp-3', category: 'MEAL', amountCents: 50_00 }),
    ]);
    expect(r.byCategory[0]?.category).toBe('LODGING');
    expect(r.byCategory[0]?.cents).toBe(800_00);
    expect(r.byCategory[1]?.category).toBe('MEAL');
  });
});
