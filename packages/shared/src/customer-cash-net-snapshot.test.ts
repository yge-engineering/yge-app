import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerCashNetSnapshot } from './customer-cash-net-snapshot';

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

function ar(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'inv-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'Caltrans',
    ...over,
  } as ArPayment;
}

function ap(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'apinv-1',
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildCustomerCashNetSnapshot', () => {
  it('sums AR for customer minus AP tied to their jobs', () => {
    const r = buildCustomerCashNetSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1', ownerAgency: 'Caltrans' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      arInvoices: [],
      arPayments: [
        ar({ id: 'a', payerName: 'Caltrans', amountCents: 100_000_00 }),
        ar({ id: 'b', payerName: 'Other', amountCents: 50_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p1', apInvoiceId: 'apinv-1', amountCents: 30_000_00 }),
        ap({ id: 'p2', apInvoiceId: 'apinv-2', amountCents: 99_000_00 }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1', 'apinv-2': 'j2' },
    });
    expect(r.totalReceiptsCents).toBe(100_000_00);
    expect(r.totalDisbursementsCents).toBe(30_000_00);
    expect(r.netCents).toBe(70_000_00);
  });

  it('excludes voided AP', () => {
    const r = buildCustomerCashNetSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1', ownerAgency: 'Caltrans' })],
      arInvoices: [],
      arPayments: [],
      apPayments: [
        ap({ id: 'p1', apInvoiceId: 'apinv-1', amountCents: 30_000_00, voided: false }),
        ap({ id: 'p2', apInvoiceId: 'apinv-1', amountCents: 99_000_00, voided: true }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1' },
    });
    expect(r.totalDisbursementsCents).toBe(30_000_00);
  });

  it('handles empty input', () => {
    const r = buildCustomerCashNetSnapshot({
      customerName: 'X',
      jobs: [],
      arInvoices: [],
      arPayments: [],
      apPayments: [],
    });
    expect(r.netCents).toBe(0);
  });
});
