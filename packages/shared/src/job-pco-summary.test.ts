import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoSummary } from './job-pco-summary';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'Test',
    description: 'Test',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-01',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildJobPcoSummary', () => {
  it('groups by jobId and counts each status', () => {
    const r = buildJobPcoSummary({
      pcos: [
        pco({ id: 'a', status: 'DRAFT' }),
        pco({ id: 'b', status: 'SUBMITTED' }),
        pco({ id: 'c', status: 'UNDER_REVIEW' }),
        pco({ id: 'd', status: 'APPROVED_PENDING_CO' }),
        pco({ id: 'e', status: 'REJECTED' }),
        pco({ id: 'f', status: 'WITHDRAWN' }),
        pco({ id: 'g', status: 'CONVERTED_TO_CO' }),
      ],
    });
    expect(r.rows[0]?.total).toBe(7);
    expect(r.rows[0]?.open).toBe(4);
    expect(r.rows[0]?.convertedToCo).toBe(1);
  });

  it('sums open cost exposure (positive impacts only on open status)', () => {
    const r = buildJobPcoSummary({
      pcos: [
        pco({ id: 'open', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 30_000_00 }),
        pco({ id: 'rejected', status: 'REJECTED', costImpactCents: 10_000_00 }),
        pco({ id: 'credit', status: 'SUBMITTED', costImpactCents: -5_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalOpenCostImpactCents).toBe(50_000_00);
  });

  it('sums schedule impact days', () => {
    const r = buildJobPcoSummary({
      pcos: [
        pco({ id: 'a', scheduleImpactDays: 5 }),
        pco({ id: 'b', scheduleImpactDays: 7 }),
      ],
    });
    expect(r.rows[0]?.totalScheduleImpactDays).toBe(12);
  });

  it('counts distinct origins', () => {
    const r = buildJobPcoSummary({
      pcos: [
        pco({ id: 'a', origin: 'OWNER_DIRECTED' }),
        pco({ id: 'b', origin: 'RFI_RESPONSE' }),
        pco({ id: 'c', origin: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows[0]?.distinctOrigins).toBe(2);
  });

  it('sorts by totalOpenCostImpactCents desc', () => {
    const r = buildJobPcoSummary({
      pcos: [
        pco({ id: 'a', jobId: 'small', costImpactCents: 5_000_00 }),
        pco({ id: 'b', jobId: 'big', costImpactCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobPcoSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      pcos: [
        pco({ id: 'old', noticedOn: '2026-03-15' }),
        pco({ id: 'in', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPcos).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildJobPcoSummary({ pcos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
