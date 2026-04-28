import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

import { buildJobRetentionReleaseReadiness } from './job-retention-release-readiness';

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

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 90_000_00,
    retentionCents: 10_000_00,
    status: 'PARTIALLY_PAID',
    ...over,
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 90_000_00,
    ...over,
  } as ArPayment;
}

function waiver(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'job-1',
    arPaymentId: 'arp-1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'DELIVERED',
    paymentAmountCents: 90_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta',
    description: 'd',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    rfiNumber: '14',
    subject: 'q',
    question: 'q',
    priority: 'MEDIUM',
    status: 'SENT',
    ...over,
  } as Rfi;
}

function submittal(over: Partial<Submittal>): Submittal {
  return {
    id: 's-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    submittalNumber: '1',
    title: 't',
    spec: '03',
    status: 'SUBMITTED',
    ...over,
  } as Submittal;
}

describe('buildJobRetentionReleaseReadiness', () => {
  it('flags NO_RETENTION when nothing is held', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [],
      arPayments: [],
      lienWaivers: [],
      punchItems: [],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.flag).toBe('NO_RETENTION');
  });

  it('flags READY when retention held + zero blockers', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [pay({})],
      lienWaivers: [waiver({})],
      punchItems: [],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.flag).toBe('READY');
  });

  it('counts SAFETY + MAJOR punches as blockers; minor ignored', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [pay({})],
      lienWaivers: [waiver({})],
      punchItems: [
        pi({ id: 'a', severity: 'SAFETY' }),
        pi({ id: 'b', severity: 'MAJOR' }),
        pi({ id: 'c', severity: 'MINOR' }),
      ],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.openSafetyPunch).toBe(1);
    expect(r.rows[0]?.openMajorPunch).toBe(1);
    expect(r.rows[0]?.blockerCount).toBe(2);
  });

  it('counts SENT RFIs as blockers; ANSWERED ignored', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [pay({})],
      lienWaivers: [waiver({})],
      punchItems: [],
      rfis: [
        rfi({ id: 'a', status: 'SENT' }),
        rfi({ id: 'b', status: 'ANSWERED' }),
      ],
      submittals: [],
    });
    expect(r.rows[0]?.openRfis).toBe(1);
  });

  it('counts SUBMITTED + REVISE_RESUBMIT submittals; APPROVED ignored', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [pay({})],
      lienWaivers: [waiver({})],
      punchItems: [],
      rfis: [],
      submittals: [
        submittal({ id: 'a', status: 'SUBMITTED' }),
        submittal({ id: 'b', status: 'APPROVED' }),
      ],
    });
    expect(r.rows[0]?.pendingSubmittals).toBe(1);
  });

  it('counts payments with no SIGNED/DELIVERED waiver as blockers', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [
        pay({ id: 'pa' }),
        pay({ id: 'pb' }),
      ],
      lienWaivers: [waiver({ arPaymentId: 'pa' })],
      punchItems: [],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.paymentsMissingWaiver).toBe(1);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      arInvoices: [],
      arPayments: [],
      lienWaivers: [],
      punchItems: [],
      rfis: [],
      submittals: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('tier classification by blocker count', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({})],
      arInvoices: [ar({})],
      arPayments: [pay({})],
      lienWaivers: [waiver({})],
      punchItems: [
        pi({ id: 'a', severity: 'SAFETY' }),
        pi({ id: 'b', severity: 'SAFETY' }),
        pi({ id: 'c', severity: 'SAFETY' }),
        pi({ id: 'd', severity: 'MAJOR' }),
      ],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.flag).toBe('NOT_READY');
  });

  it('rolls up totals + sorts READY first', () => {
    const r = buildJobRetentionReleaseReadiness({
      jobs: [job({ id: 'ready' }), job({ id: 'no' })],
      arInvoices: [ar({ jobId: 'ready' })],
      arPayments: [pay({ jobId: 'ready' })],
      lienWaivers: [waiver({ jobId: 'ready' })],
      punchItems: [],
      rfis: [],
      submittals: [],
    });
    expect(r.rows[0]?.jobId).toBe('ready');
    expect(r.rollup.totalReadyRetentionCents).toBe(10_000_00);
  });
});
