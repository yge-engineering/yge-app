import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerCashNetDetailSnapshot } from './customer-cash-net-detail-snapshot';

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
    amountCents: 50_000_00,
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

describe('buildCustomerCashNetDetailSnapshot', () => {
  it('returns rows sorted by net cents descending', () => {
    const r = buildCustomerCashNetDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      arPayments: [
        ar({ id: 'a', jobId: 'j1', amountCents: 100_000_00 }),
        ar({ id: 'b', jobId: 'j2', amountCents: 50_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p1', apInvoiceId: 'apinv-j1', amountCents: 30_000_00 }),
        ap({ id: 'p2', apInvoiceId: 'apinv-j2', amountCents: 10_000_00 }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-j1': 'j1', 'apinv-j2': 'j2' },
    });
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.netCents).toBe(70_000_00);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.netCents).toBe(40_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerCashNetDetailSnapshot({
      customerName: 'X',
      jobs: [],
      arPayments: [],
      apPayments: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
