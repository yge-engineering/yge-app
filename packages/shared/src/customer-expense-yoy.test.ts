import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerExpenseYoy } from './customer-expense-yoy';

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

describe('buildCustomerExpenseYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerExpenseYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      expenses: [
        ex({ id: 'a', receiptDate: '2025-04-15', amountCents: 30_00 }),
        ex({ id: 'b', receiptDate: '2026-04-15', amountCents: 50_00 }),
      ],
    });
    expect(r.priorReceipts).toBe(1);
    expect(r.currentReceipts).toBe(1);
    expect(r.centsDelta).toBe(20_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerExpenseYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      expenses: [],
    });
    expect(r.priorReceipts).toBe(0);
  });
});
