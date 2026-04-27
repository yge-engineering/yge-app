import { describe, expect, it } from 'vitest';
import { buildJobDashboard } from './job-dashboard';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { DailyReport } from './daily-report';
import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

function job(over: Partial<Job>): Job {
  return {
    id: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    status: 'AWARDED',
    ...over,
  } as Job;
}

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'x',
    description: 'fix',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    rfiNumber: 'RFI-001',
    subject: 'q',
    question: '',
    status: 'SENT',
    priority: 'MEDIUM',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    submittalNumber: 'S-1',
    subject: 'shop',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-1',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-15',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 90_000_00,
    retentionCents: 10_000_00,
    status: 'PARTIALLY_PAID',
    ...over,
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'pay-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'RETENTION_RELEASE',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 0,
    ...over,
  } as ArPayment;
}

describe('buildJobDashboard', () => {
  it('CLEAN when no open items', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
    });
    expect(r.rows[0]?.flag).toBe('CLEAN');
  });

  it('WATCH when open punch / RFI / submittal counts are non-zero (small)', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      punchItems: [pi({ status: 'OPEN' })],
    });
    expect(r.rows[0]?.flag).toBe('WATCH');
  });

  it('ATTENTION when any safety punch item exists', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      punchItems: [pi({ severity: 'SAFETY' })],
    });
    expect(r.rows[0]?.flag).toBe('ATTENTION');
  });

  it('ATTENTION when 5+ combined open items', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      punchItems: [
        pi({ id: 'p1' }),
        pi({ id: 'p2' }),
        pi({ id: 'p3' }),
      ],
      rfis: [rfi({ id: 'r1' }), rfi({ id: 'r2' })],
    });
    expect(r.rows[0]?.flag).toBe('ATTENTION');
  });

  it('STALE when AWARDED job has no daily report in 14+ days', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1', status: 'AWARDED' })],
      dailyReports: [dr({ date: '2026-04-01' })], // 26 days ago
    });
    expect(r.rows[0]?.flag).toBe('STALE');
  });

  it('lastDailyReportOn picks latest submitted', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      dailyReports: [
        dr({ id: '1', date: '2026-04-13' }),
        dr({ id: '2', date: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.lastDailyReportOn).toBe('2026-04-25');
  });

  it('retentionOutstanding = held minus released', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      arInvoices: [ar({ retentionCents: 10_000_00 })],
      arPayments: [pay({ amountCents: 4_000_00 })],
    });
    expect(r.rows[0]?.retentionOutstandingCents).toBe(6_000_00);
  });

  it('honors percentCompleteByJobId map', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      percentCompleteByJobId: new Map([['job-1', 0.42]]),
    });
    expect(r.rows[0]?.percentComplete).toBe(0.42);
  });

  it('skips closed punch items', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [job({ id: 'job-1' })],
      punchItems: [
        pi({ id: '1', status: 'CLOSED' }),
        pi({ id: '2', status: 'WAIVED' }),
      ],
    });
    expect(r.rows[0]?.openPunchItems).toBe(0);
    expect(r.rows[0]?.flag).toBe('CLEAN');
  });

  it('sorts ATTENTION first, CLEAN last', () => {
    const r = buildJobDashboard({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'clean' }),
        job({ id: 'attn' }),
      ],
      punchItems: [pi({ jobId: 'attn', severity: 'SAFETY' })],
    });
    expect(r.rows[0]?.jobId).toBe('attn');
  });
});
