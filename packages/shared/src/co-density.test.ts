import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCoDensity } from './co-density';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Add 2 inches of base rock',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    proposedAt: '2026-01-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

const job: Pick<Job, 'id' | 'projectName'> = {
  id: 'job-1',
  projectName: 'Sulphur Springs',
};

describe('buildCoDensity', () => {
  it('classifies CLEAN when executed impact is <5% of contract', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [co({ totalCostImpactCents: 30_000_00 })],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('CLEAN');
    expect(r.rows[0]?.executedImpactPct).toBe(0.03);
  });

  it('classifies NORMAL (5-15%)', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [co({ totalCostImpactCents: 100_000_00 })],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('NORMAL');
  });

  it('classifies HIGH (15-30%)', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [co({ totalCostImpactCents: 200_000_00 })],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('HIGH');
  });

  it('classifies EXTREME (30%+)', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [co({ totalCostImpactCents: 400_000_00 })],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.flag).toBe('EXTREME');
  });

  it('counts open COs separately from executed', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', totalCostImpactCents: 10_000_00 }),
        co({ id: 'co-2', status: 'AGENCY_REVIEW', totalCostImpactCents: 20_000_00 }),
        co({ id: 'co-3', status: 'PROPOSED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'co-4', status: 'REJECTED', totalCostImpactCents: 99_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.executedCount).toBe(1);
    expect(r.rows[0]?.pendingCount).toBe(2);
    expect(r.rows[0]?.executedImpactCents).toBe(10_000_00);
    expect(r.rows[0]?.openImpactCents).toBe(50_000_00);
  });

  it('uses absolute value for deduct-COs (still represent change activity)', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', totalCostImpactCents: -50_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.executedImpactCents).toBe(50_000_00);
  });

  it('counts schedule impact days across executed COs only', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', totalScheduleImpactDays: 5 }),
        co({ id: 'co-2', status: 'EXECUTED', totalScheduleImpactDays: 3 }),
        co({ id: 'co-3', status: 'PROPOSED', totalScheduleImpactDays: 99 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.scheduleImpactDays).toBe(8);
  });

  it('returns top reasons sorted by count desc', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', reason: 'RFI_RESPONSE' }),
        co({ id: 'co-2', status: 'EXECUTED', reason: 'RFI_RESPONSE' }),
        co({ id: 'co-3', status: 'EXECUTED', reason: 'DIFFERING_SITE_CONDITION' }),
        co({ id: 'co-4', status: 'EXECUTED', reason: 'OWNER_DIRECTED' }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.topReasons[0]?.reason).toBe('RFI_RESPONSE');
    expect(r.rows[0]?.topReasons[0]?.count).toBe(2);
  });

  it('rolls up high-impact-jobs count (HIGH + EXTREME)', () => {
    const r = buildCoDensity({
      jobs: [
        { id: 'job-1', projectName: 'Clean job' },
        { id: 'job-2', projectName: 'High job' },
        { id: 'job-3', projectName: 'Extreme job' },
      ],
      changeOrders: [
        co({ id: 'co-1', jobId: 'job-1', totalCostImpactCents: 10_000_00 }),    // CLEAN
        co({ id: 'co-2', jobId: 'job-2', totalCostImpactCents: 200_000_00 }),    // HIGH
        co({ id: 'co-3', jobId: 'job-3', totalCostImpactCents: 400_000_00 }),    // EXTREME
      ],
      originalContractByJobId: new Map([
        ['job-1', 1_000_000_00],
        ['job-2', 1_000_000_00],
        ['job-3', 1_000_000_00],
      ]),
    });
    expect(r.rollup.highImpactJobs).toBe(2);
    expect(r.rollup.totalExecutedCount).toBe(3);
  });

  it('handles original contract = 0 (returns 0 pct, CLEAN)', () => {
    const r = buildCoDensity({
      jobs: [job],
      changeOrders: [co({ totalCostImpactCents: 50_000_00 })],
      originalContractByJobId: new Map([['job-1', 0]]),
    });
    expect(r.rows[0]?.executedImpactPct).toBe(0);
    expect(r.rows[0]?.flag).toBe('CLEAN');
  });
});
