import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

import { buildJobApYoy } from './job-ap-yoy';

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

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-25',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildJobApYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobApYoy({
      jobId: 'j1',
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      apPayments: [app({ apInvoiceId: 'b', amountCents: 30_000_00 })],
    });
    expect(r.priorBilledCents).toBe(50_000_00);
    expect(r.currentBilledCents).toBe(100_000_00);
    expect(r.currentPaidCents).toBe(30_000_00);
    expect(r.currentOpenCents).toBe(70_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobApYoy({
      jobId: 'X',
      currentYear: 2026,
      apInvoices: [],
      apPayments: [],
    });
    expect(r.priorInvoices).toBe(0);
  });
});
