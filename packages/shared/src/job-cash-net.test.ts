import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildJobCashNet } from './job-cash-net';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function arP(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    ...over,
  } as ArPayment;
}

function apI(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 50_000_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

function apP(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Acme Supply',
    method: 'CHECK',
    paidOn: '2026-04-20',
    amountCents: 30_000_00,
    ...over,
  } as ApPayment;
}

describe('buildJobCashNet', () => {
  it('rolls up AR cash in per job', () => {
    const r = buildJobCashNet({
      jobs: [job({})],
      arPayments: [
        arP({ id: 'a', amountCents: 50_000_00 }),
        arP({ id: 'b', amountCents: 30_000_00 }),
      ],
      apPayments: [],
      apInvoices: [],
    });
    expect(r.rows[0]?.cashInCents).toBe(80_000_00);
    expect(r.rows[0]?.arPaymentCount).toBe(2);
  });

  it('routes AP payments via apInvoice.jobId', () => {
    const r = buildJobCashNet({
      jobs: [job({})],
      arPayments: [],
      apPayments: [apP({ amountCents: 30_000_00 })],
      apInvoices: [apI({})],
    });
    expect(r.rows[0]?.cashOutCents).toBe(30_000_00);
    expect(r.rows[0]?.apPaymentCount).toBe(1);
  });

  it('skips AP payments whose invoice has no jobId', () => {
    const r = buildJobCashNet({
      jobs: [job({})],
      arPayments: [],
      apPayments: [apP({})],
      apInvoices: [apI({ jobId: undefined })],
    });
    expect(r.rows[0]?.cashOutCents).toBe(0);
  });

  it('computes net = in - out', () => {
    const r = buildJobCashNet({
      jobs: [job({})],
      arPayments: [arP({ amountCents: 100_000_00 })],
      apPayments: [apP({ amountCents: 30_000_00 })],
      apInvoices: [apI({})],
    });
    expect(r.rows[0]?.netCents).toBe(70_000_00);
  });

  it('respects window bounds', () => {
    const r = buildJobCashNet({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      jobs: [job({})],
      arPayments: [
        arP({ id: 'old', receivedOn: '2026-04-01', amountCents: 99_000_00 }),
        arP({ id: 'in', receivedOn: '2026-04-20', amountCents: 5_000_00 }),
      ],
      apPayments: [],
      apInvoices: [],
    });
    expect(r.rows[0]?.cashInCents).toBe(5_000_00);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobCashNet({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      arPayments: [],
      apPayments: [],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rolls up totals + counts net-negative jobs', () => {
    const r = buildJobCashNet({
      jobs: [
        job({ id: 'positive' }),
        job({ id: 'negative' }),
      ],
      arPayments: [
        arP({ id: 'a1', jobId: 'positive', amountCents: 100_000_00 }),
        arP({ id: 'a2', jobId: 'negative', amountCents: 10_000_00 }),
      ],
      apPayments: [
        apP({ id: 'p1', apInvoiceId: 'inv-pos' }),
        apP({ id: 'p2', apInvoiceId: 'inv-neg', amountCents: 50_000_00 }),
      ],
      apInvoices: [
        apI({ id: 'inv-pos', jobId: 'positive' }),
        apI({ id: 'inv-neg', jobId: 'negative' }),
      ],
    });
    expect(r.rollup.totalCashInCents).toBe(110_000_00);
    expect(r.rollup.totalCashOutCents).toBe(80_000_00);
    expect(r.rollup.netNegativeJobs).toBe(1);
  });

  it('sorts most-negative net first', () => {
    const r = buildJobCashNet({
      jobs: [job({ id: 'positive' }), job({ id: 'negative' })],
      arPayments: [
        arP({ id: 'a1', jobId: 'positive', amountCents: 100_000_00 }),
        arP({ id: 'a2', jobId: 'negative', amountCents: 10_000_00 }),
      ],
      apPayments: [
        apP({ id: 'p2', apInvoiceId: 'inv-neg', amountCents: 50_000_00 }),
      ],
      apInvoices: [
        apI({ id: 'inv-pos', jobId: 'positive' }),
        apI({ id: 'inv-neg', jobId: 'negative' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('negative');
  });
});
