import { describe, expect, it } from 'vitest';
import {
  buildAllReimbursementSummaries,
  buildEmployeeReimbursementSummary,
  computeReimbursementGrandTotals,
} from './reimbursement-summary';
import type { Expense } from './expense';
import type { MileageEntry } from './mileage';

function mile(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    employeeId: 'emp-1',
    employeeName: 'Jane Doe',
    tripDate: '2026-04-15',
    vehicleDescription: 'Personal Tacoma',
    isPersonalVehicle: true,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'exp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    employeeId: 'emp-1',
    employeeName: 'Jane Doe',
    receiptDate: '2026-04-16',
    vendor: 'Holiday Inn',
    description: 'Lodging',
    amountCents: 250_00,
    category: 'LODGING',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildEmployeeReimbursementSummary', () => {
  it('only includes outstanding personal-vehicle mileage', () => {
    const r = buildEmployeeReimbursementSummary({
      employeeId: 'emp-1',
      employeeName: 'Jane Doe',
      mileage: [
        mile({ id: 'mi-1', businessMiles: 50, irsRateCentsPerMile: 67 }),
        mile({ id: 'mi-2', businessMiles: 30, isPersonalVehicle: false }),
        mile({ id: 'mi-3', businessMiles: 99, reimbursed: true, irsRateCentsPerMile: 67 }),
        mile({ id: 'mi-4', employeeId: 'emp-OTHER', businessMiles: 999 }),
      ],
      expenses: [],
    });
    expect(r.mileageRows).toHaveLength(1);
    expect(r.mileageRows[0]?.id).toBe('mi-1');
    expect(r.totalMiles).toBe(50);
    expect(r.totalMileageCents).toBe(50 * 67);
  });

  it('only includes outstanding out-of-pocket expenses', () => {
    const r = buildEmployeeReimbursementSummary({
      employeeId: 'emp-1',
      employeeName: 'Jane Doe',
      mileage: [],
      expenses: [
        exp({ id: 'exp-1', amountCents: 250_00 }),
        exp({ id: 'exp-2', amountCents: 100_00, paidWithCompanyCard: true }),
        exp({ id: 'exp-3', amountCents: 50_00, reimbursed: true }),
        exp({ id: 'exp-4', employeeId: 'emp-OTHER', amountCents: 999_99 }),
      ],
    });
    expect(r.expenseRows).toHaveLength(1);
    expect(r.expenseRows[0]?.id).toBe('exp-1');
    expect(r.totalExpenseCents).toBe(250_00);
  });

  it('sums mileage + expenses into totalCents', () => {
    const r = buildEmployeeReimbursementSummary({
      employeeId: 'emp-1',
      employeeName: 'Jane Doe',
      mileage: [mile({ id: 'mi-1', businessMiles: 100, irsRateCentsPerMile: 67 })],
      expenses: [exp({ id: 'exp-1', amountCents: 50_00 })],
    });
    expect(r.totalMileageCents).toBe(67_00);
    expect(r.totalExpenseCents).toBe(50_00);
    expect(r.totalCents).toBe(117_00);
  });

  it('sorts rows by date ascending', () => {
    const r = buildEmployeeReimbursementSummary({
      employeeId: 'emp-1',
      employeeName: 'Jane Doe',
      mileage: [
        mile({ id: 'mi-late', tripDate: '2026-04-30', irsRateCentsPerMile: 67 }),
        mile({ id: 'mi-early', tripDate: '2026-04-01', irsRateCentsPerMile: 67 }),
      ],
      expenses: [],
    });
    expect(r.mileageRows[0]?.id).toBe('mi-early');
    expect(r.mileageRows[1]?.id).toBe('mi-late');
  });
});

describe('buildAllReimbursementSummaries', () => {
  it('returns one summary per employee with outstanding amounts, sorted by total desc', () => {
    const summaries = buildAllReimbursementSummaries({
      mileage: [
        mile({
          id: 'mi-1',
          employeeId: 'emp-1',
          employeeName: 'Jane',
          businessMiles: 50,
          irsRateCentsPerMile: 67,
        }),
        mile({
          id: 'mi-2',
          employeeId: 'emp-2',
          employeeName: 'Bob',
          businessMiles: 200,
          irsRateCentsPerMile: 67,
        }),
      ],
      expenses: [
        exp({ id: 'exp-1', employeeId: 'emp-1', employeeName: 'Jane', amountCents: 100_000_00 }),
      ],
    });
    expect(summaries).toHaveLength(2);
    // Jane has $100,033.50 owed; Bob has $134
    expect(summaries[0]?.employeeId).toBe('emp-1');
    expect(summaries[1]?.employeeId).toBe('emp-2');
  });

  it('skips employees whose only entries are reimbursed or company-card', () => {
    const summaries = buildAllReimbursementSummaries({
      mileage: [
        mile({ id: 'mi-1', employeeId: 'emp-1', employeeName: 'Jane', reimbursed: true }),
      ],
      expenses: [
        exp({
          id: 'exp-1',
          employeeId: 'emp-2',
          employeeName: 'Bob',
          paidWithCompanyCard: true,
          amountCents: 999_00,
        }),
      ],
    });
    expect(summaries).toHaveLength(0);
  });
});

describe('computeReimbursementGrandTotals', () => {
  it('sums across summaries', () => {
    const summaries = buildAllReimbursementSummaries({
      mileage: [
        mile({
          id: 'mi-1',
          employeeId: 'emp-1',
          employeeName: 'Jane',
          businessMiles: 50,
          irsRateCentsPerMile: 67,
        }),
      ],
      expenses: [exp({ id: 'exp-1', amountCents: 250_00 })],
    });
    const t = computeReimbursementGrandTotals(summaries);
    expect(t.employees).toBe(1);
    expect(t.mileageCents).toBe(50 * 67);
    expect(t.expenseCents).toBe(250_00);
    expect(t.totalCents).toBe(50 * 67 + 250_00);
  });
});
