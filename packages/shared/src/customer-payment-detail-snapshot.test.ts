import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerPaymentDetailSnapshot } from './customer-payment-detail-snapshot';

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

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    amountCents: 100_000_00,
    receivedOn: '2026-04-15',
    payerName: 'Caltrans',
    ...over,
  } as ArPayment;
}

describe('buildCustomerPaymentDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildCustomerPaymentDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      arPayments: [
        arp({ id: 'a', jobId: 'j1', kind: 'PROGRESS', method: 'ACH', amountCents: 100_000_00 }),
        arp({ id: 'b', jobId: 'j1', kind: 'RETENTION_RELEASE', method: 'WIRE', amountCents: 25_000_00 }),
        arp({ id: 'c', jobId: 'j1', kind: 'FINAL', method: 'CHECK', amountCents: 50_000_00 }),
        arp({ id: 'd', jobId: 'j2', kind: 'PROGRESS', method: 'CHECK', amountCents: 30_000_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.paymentCount).toBe(3);
    expect(r.rows[0]?.totalCents).toBe(175_000_00);
    expect(r.rows[0]?.progressCents).toBe(100_000_00);
    expect(r.rows[0]?.retentionReleaseCount).toBe(1);
    expect(r.rows[0]?.retentionReleaseCents).toBe(25_000_00);
    expect(r.rows[0]?.finalCount).toBe(1);
    expect(r.rows[0]?.achCount).toBe(1);
    expect(r.rows[0]?.checkCount).toBe(1);
    expect(r.rows[0]?.wireCount).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.totalCents).toBe(30_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPaymentDetailSnapshot({
      customerName: 'X',
      jobs: [],
      arPayments: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
