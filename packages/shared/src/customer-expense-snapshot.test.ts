import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerExpenseSnapshot } from './customer-expense-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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
    description: 'Concrete patch',
    amountCents: 50_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildCustomerExpenseSnapshot', () => {
  it('joins receipts to a customer via job.ownerAgency', () => {
    const r = buildCustomerExpenseSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      expenses: [ex({ id: 'a', jobId: 'j1' }), ex({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalReceipts).toBe(1);
  });

  it('separates pending vs reimbursed (out-of-pocket only)', () => {
    const r = buildCustomerExpenseSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      expenses: [
        ex({ id: 'a', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'b', amountCents: 50_00, paidWithCompanyCard: false, reimbursed: true }),
      ],
    });
    expect(r.pendingReimbursementCents).toBe(100_00);
    expect(r.reimbursedCents).toBe(50_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerExpenseSnapshot({ customerName: 'X', jobs: [], expenses: [] });
    expect(r.totalReceipts).toBe(0);
  });
});
