import { describe, expect, it } from 'vitest';
import { buildPcoCoVarianceReport } from './pco-vs-co-analysis';
import type { ChangeOrder } from './change-order';
import type { Pco } from './pco';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    pcoNumber: 'PCO-001',
    title: 'Extra rebar',
    description: 'something',
    origin: 'OWNER_DIRECTED',
    status: 'CONVERTED_TO_CO',
    noticedOn: '2026-01-01',
    submittedOn: '2026-01-15',
    costImpactCents: 100_00,
    scheduleImpactDays: 0,
    changeOrderId: 'co-1',
    ...over,
  } as Pco;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    changeOrderNumber: 'CO-001',
    subject: 'Extra rebar',
    description: 'something',
    reason: 'OWNER_DIRECTED',
    lineItems: [],
    totalCostImpactCents: 100_00,
    totalScheduleImpactDays: 0,
    status: 'EXECUTED',
    ...over,
  } as ChangeOrder;
}

describe('buildPcoCoVarianceReport', () => {
  it('joins PCO to executed CO and computes variance', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [pco({ costImpactCents: 100_00 })],
      changeOrders: [co({ totalCostImpactCents: 80_00 })],
    });
    expect(r.pairsConsidered).toBe(1);
    expect(r.rows[0]?.varianceCents).toBe(-20_00);
    expect(r.rows[0]?.variancePct).toBe(-0.2);
  });

  it('skips non-CONVERTED PCOs', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [
        pco({ id: '1', status: 'SUBMITTED' }),
        pco({ id: '2', status: 'REJECTED' }),
        pco({ id: '3', status: 'CONVERTED_TO_CO' }),
      ],
      changeOrders: [co({ id: 'co-1' })],
    });
    expect(r.pairsConsidered).toBe(1);
  });

  it('skips PCOs with no changeOrderId link', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [pco({ changeOrderId: undefined })],
      changeOrders: [co({})],
    });
    expect(r.pairsConsidered).toBe(0);
  });

  it('skips when CO is not EXECUTED', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [pco({})],
      changeOrders: [co({ status: 'APPROVED' })],
    });
    expect(r.pairsConsidered).toBe(0);
  });

  it('counts acceptedAtFull vs negotiatedDown', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [
        pco({ id: '1', costImpactCents: 100_00, changeOrderId: 'co-a' }),
        pco({ id: '2', costImpactCents: 100_00, changeOrderId: 'co-b' }),
      ],
      changeOrders: [
        co({ id: 'co-a', totalCostImpactCents: 100_00 }), // accepted
        co({ id: 'co-b', totalCostImpactCents: 80_00 }),  // negotiated down
      ],
    });
    expect(r.acceptedAtFullCount).toBe(1);
    expect(r.negotiatedDownCount).toBe(1);
  });

  it('sorts most-negative variance first', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [
        pco({ id: 'small-cut', costImpactCents: 100_00, changeOrderId: 'co-a' }),
        pco({ id: 'big-cut', costImpactCents: 100_00, changeOrderId: 'co-b' }),
      ],
      changeOrders: [
        co({ id: 'co-a', totalCostImpactCents: 90_00 }),  // -10
        co({ id: 'co-b', totalCostImpactCents: 50_00 }),  // -50
      ],
    });
    expect(r.rows[0]?.pcoId).toBe('big-cut');
  });

  it('rollup: blendedVariancePct = totalVariance / totalProposed', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [
        pco({ id: '1', costImpactCents: 100_00, changeOrderId: 'co-a' }),
        pco({ id: '2', costImpactCents: 100_00, changeOrderId: 'co-b' }),
      ],
      changeOrders: [
        co({ id: 'co-a', totalCostImpactCents: 100_00 }),  // 0
        co({ id: 'co-b', totalCostImpactCents: 60_00 }),   // -40
      ],
    });
    expect(r.totalProposedCents).toBe(200_00);
    expect(r.totalExecutedCents).toBe(160_00);
    expect(r.blendedVariancePct).toBe(-0.2);
  });

  it('groups missing agencyContact under Unknown', () => {
    const r = buildPcoCoVarianceReport({
      pcos: [pco({ agencyContact: undefined })],
      changeOrders: [co({})],
    });
    expect(r.rows[0]?.agencyContact).toBe('Unknown');
  });
});
