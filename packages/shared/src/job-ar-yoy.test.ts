import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildJobArYoy } from './job-ar-yoy';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-25',
    amountCents: 30_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildJobArYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobArYoy({
      jobId: 'j1',
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      arPayments: [
        arp({ arInvoiceId: 'b', amountCents: 30_000_00 }),
      ],
    });
    expect(r.priorBilledCents).toBe(50_000_00);
    expect(r.currentBilledCents).toBe(100_000_00);
    expect(r.currentPaidCents).toBe(30_000_00);
    expect(r.currentOpenCents).toBe(70_000_00);
    expect(r.billedDelta).toBe(50_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobArYoy({
      jobId: 'X',
      currentYear: 2026,
      arInvoices: [],
      arPayments: [],
    });
    expect(r.priorInvoices).toBe(0);
  });
});
