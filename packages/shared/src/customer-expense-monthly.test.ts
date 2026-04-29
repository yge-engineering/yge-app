import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerExpenseMonthly } from './customer-expense-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'ex-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    amountCents: 50_00,
    category: 'FUEL',
    description: 'Test',
    reimbursed: false,
    jobId: 'j1',
    ...over,
  } as Expense;
}

describe('buildCustomerExpenseMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      expenses: [
        exp({ id: 'a', jobId: 'j1', receiptDate: '2026-04-15' }),
        exp({ id: 'b', jobId: 'j2', receiptDate: '2026-04-15' }),
        exp({ id: 'c', jobId: 'j1', receiptDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents per (customer, month)', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [job({ id: 'j1' })],
      expenses: [
        exp({ id: 'a', amountCents: 30_00 }),
        exp({ id: 'b', amountCents: 70_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_00);
    expect(r.rows[0]?.count).toBe(2);
  });

  it('breaks down by category', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [job({ id: 'j1' })],
      expenses: [
        exp({ id: 'a', category: 'FUEL' }),
        exp({ id: 'b', category: 'MEAL' }),
        exp({ id: 'c', category: 'FUEL' }),
      ],
    });
    expect(r.rows[0]?.byCategory.FUEL).toBe(2);
    expect(r.rows[0]?.byCategory.MEAL).toBe(1);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      expenses: [
        exp({ id: 'a', employeeName: 'Pat', jobId: 'j1' }),
        exp({ id: 'b', employeeName: 'Sam', jobId: 'j2' }),
        exp({ id: 'c', employeeName: 'Pat', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no jobId or no matching job)', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [job({ id: 'j1' })],
      expenses: [
        exp({ id: 'a', jobId: 'j1' }),
        exp({ id: 'b', jobId: undefined }),
        exp({ id: 'c', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerExpenseMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalReceipts).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerExpenseMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      expenses: [
        exp({ id: 'a', jobId: 'jZ', receiptDate: '2026-04-15' }),
        exp({ id: 'b', jobId: 'jA', receiptDate: '2026-05-01' }),
        exp({ id: 'c', jobId: 'jA', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerExpenseMonthly({ jobs: [], expenses: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
