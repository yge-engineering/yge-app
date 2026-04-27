import { describe, expect, it } from 'vitest';
import { buildPcoExposure } from './pco-exposure';
import type { Pco } from './pco';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '2026-04-15T00:00:00Z',
    jobId: 'job-1',
    pcoNumber: 'PCO-001',
    title: 'Extra rebar',
    description: 'Something extra',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-01',
    submittedOn: '2026-04-05',
    costImpactCents: 10_000_00,
    scheduleImpactDays: 0,
    ...over,
  } as Pco;
}

describe('buildPcoExposure', () => {
  it('rolls open exposure by bucket', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({ id: 'a', status: 'DRAFT', costImpactCents: 1_000_00 }),
        pco({ id: 'b', status: 'SUBMITTED', costImpactCents: 5_000_00 }),
        pco({ id: 'c', status: 'UNDER_REVIEW', costImpactCents: 7_500_00 }),
        pco({ id: 'd', status: 'APPROVED_PENDING_CO', costImpactCents: 12_000_00 }),
        pco({ id: 'e', status: 'CONVERTED_TO_CO', costImpactCents: 99_999_00 }),
        pco({ id: 'f', status: 'REJECTED', costImpactCents: 99_999_00 }),
        pco({ id: 'g', status: 'WITHDRAWN', costImpactCents: 99_999_00 }),
      ],
    });
    expect(r.rollup.totalOpenExposureCents).toBe(
      1_000_00 + 5_000_00 + 7_500_00 + 12_000_00,
    );
    expect(r.rollup.exposureByBucket.DRAFT).toBe(1_000_00);
    expect(r.rollup.exposureByBucket.APPROVED_PENDING_CO).toBe(12_000_00);
    expect(r.rollup.openCount).toBe(4);
  });

  it('finds oldest-open PCO', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({ id: 'newish', status: 'SUBMITTED', submittedOn: '2026-04-20' }),
        pco({ id: 'old', status: 'SUBMITTED', submittedOn: '2026-02-01' }),
        pco({ id: 'mid', status: 'SUBMITTED', submittedOn: '2026-03-15' }),
      ],
    });
    expect(r.rollup.oldestOpen?.pcoId).toBe('old');
  });

  it('uses noticedOn fallback when submittedOn missing', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({
          id: 'unsent',
          status: 'DRAFT',
          submittedOn: undefined,
          noticedOn: '2026-04-01',
        }),
      ],
    });
    expect(r.rows[0]?.daysOutstanding).toBe(26);
    expect(r.rows[0]?.notYetSubmitted).toBe(true);
  });

  it('conversion analytics: rate excludes WITHDRAWN from denominator', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({ id: '1', status: 'CONVERTED_TO_CO' }),
        pco({ id: '2', status: 'CONVERTED_TO_CO' }),
        pco({ id: '3', status: 'CONVERTED_TO_CO' }),
        pco({ id: '4', status: 'REJECTED' }),
        pco({ id: '5', status: 'WITHDRAWN' }),  // not counted in rate
        pco({ id: '6', status: 'SUBMITTED' }),  // open, not counted
      ],
    });
    expect(r.conversion.totalPcos).toBe(6);
    expect(r.conversion.convertedCount).toBe(3);
    expect(r.conversion.rejectedCount).toBe(1);
    expect(r.conversion.decidedPcos).toBe(4);   // 3 converted + 1 rejected
    expect(r.conversion.conversionRate).toBe(0.75);
  });

  it('avgDaysToConversion uses lastResponseOn for converted PCOs', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({
          id: '1',
          status: 'CONVERTED_TO_CO',
          submittedOn: '2026-01-01',
          lastResponseOn: '2026-02-15', // 45 days
        }),
        pco({
          id: '2',
          status: 'CONVERTED_TO_CO',
          submittedOn: '2026-03-01',
          lastResponseOn: '2026-04-04', // 34 days
        }),
      ],
    });
    expect(r.conversion.avgDaysToConversion).toBe(40); // (45+34)/2 = 39.5 → 40
  });

  it('sorts open first (oldest-first within open), closed at the bottom', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({ id: 'closed-conv', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'open-young', status: 'SUBMITTED', submittedOn: '2026-04-20' }),
        pco({ id: 'open-old', status: 'SUBMITTED', submittedOn: '2026-02-01' }),
        pco({ id: 'closed-rej', status: 'REJECTED' }),
      ],
    });
    expect(r.rows.map((x) => x.pcoId)).toEqual([
      'open-old',     // OPEN, oldest
      'open-young',   // OPEN, newer
      'closed-conv',  // CONVERTED
      'closed-rej',   // REJECTED
    ]);
  });

  it('rolls up schedule-day exposure across open PCOs', () => {
    const r = buildPcoExposure({
      asOf: '2026-04-27',
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED', scheduleImpactDays: 5 }),
        pco({ id: 'b', status: 'APPROVED_PENDING_CO', scheduleImpactDays: 12 }),
        pco({ id: 'c', status: 'CONVERTED_TO_CO', scheduleImpactDays: 99 }), // closed; skip
      ],
    });
    expect(r.rollup.totalScheduleImpactDays).toBe(17);
  });
});
