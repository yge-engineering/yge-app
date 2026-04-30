import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerExpenseDetailSnapshot } from './customer-expense-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

function ex(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    vendor: 'Home Depot',
    description: 'X',
    amountCents: 50_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildCustomerExpenseDetailSnapshot', () => {
  it('returns one row per job sorted by spend', () => {
    const r = buildCustomerExpenseDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      expenses: [
        ex({ id: 'a', jobId: 'j1', amountCents: 100_00 }),
        ex({ id: 'b', jobId: 'j2', amountCents: 50_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.totalCents).toBe(100_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerExpenseDetailSnapshot({
      customerName: 'X',
      jobs: [],
      expenses: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
