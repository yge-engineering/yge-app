import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildVendorJobDetailYoy } from './vendor-job-detail-yoy';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function ex(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    vendor: 'Granite',
    description: 'X',
    amountCents: 5_000_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildVendorJobDetailYoy', () => {
  it('returns one row per job touched in either year', () => {
    const r = buildVendorJobDetailYoy({
      vendorName: 'Granite',
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', jobId: 'j1', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', jobId: 'j1', totalCents: 100_000_00 }),
        ap({ id: 'c', invoiceDate: '2026-04-15', jobId: 'j2', totalCents: 25_000_00 }),
      ],
      expenses: [],
    });
    expect(r.rows.length).toBe(2);
    const j1 = r.rows.find((row) => row.jobId === 'j1');
    expect(j1?.priorTotalCents).toBe(50_000_00);
    expect(j1?.currentTotalCents).toBe(100_000_00);
    expect(j1?.totalDelta).toBe(50_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorJobDetailYoy({
      vendorName: 'X',
      currentYear: 2026,
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
