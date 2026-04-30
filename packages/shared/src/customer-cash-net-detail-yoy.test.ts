import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerCashNetDetailYoy } from './customer-cash-net-detail-yoy';

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
    amountCents: 100_000_00,
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

describe('buildCustomerCashNetDetailYoy', () => {
  it('returns one row per job with prior + current net + delta', () => {
    const r = buildCustomerCashNetDetailYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      arPayments: [
        ar({ id: 'a', receivedOn: '2025-04-15', amountCents: 50_000_00 }),
        ar({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p1', paidOn: '2025-04-15', amountCents: 20_000_00 }),
        ap({ id: 'p2', paidOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1' },
    });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]?.priorNetCents).toBe(30_000_00);
    expect(r.rows[0]?.currentNetCents).toBe(70_000_00);
    expect(r.rows[0]?.netDelta).toBe(40_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerCashNetDetailYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      arPayments: [],
      apPayments: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
