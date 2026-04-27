import { describe, expect, it } from 'vitest';
import { buildBidPursuitPipeline } from './bid-pipeline';
import type { PricedEstimate } from './priced-estimate';

function est(over: Partial<PricedEstimate>): PricedEstimate {
  return {
    id: 'est-1',
    fromDraftId: 'draft-1',
    jobId: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    bidItems: [
      { description: 'mob', quantity: 1, unitPriceCents: 50_000_00, unit: 'LS' } as never,
    ],
    oppPercent: 0.2,
    subBids: [],
    addenda: [],
    ...over,
  } as PricedEstimate;
}

describe('buildBidPursuitPipeline', () => {
  it('classifies urgency from bidDueDate', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({ id: 'overdue', bidDueDate: '2026-04-20' }),
        est({ id: 'today', bidDueDate: '2026-04-27' }),
        est({ id: 'thisweek', bidDueDate: '2026-04-30' }),
        est({ id: 'nextweek', bidDueDate: '2026-05-08' }),
        est({ id: 'later', bidDueDate: '2026-06-01' }),
        est({ id: 'no-date' }),
      ],
    });
    const tiers = new Map(r.rows.map((x) => [x.estimateId, x.urgency]));
    expect(tiers.get('overdue')).toBe('OVERDUE');
    expect(tiers.get('today')).toBe('TODAY');
    expect(tiers.get('thisweek')).toBe('THIS_WEEK');
    expect(tiers.get('nextweek')).toBe('NEXT_WEEK');
    expect(tiers.get('later')).toBe('LATER');
    expect(tiers.get('no-date')).toBe('NO_DATE');
  });

  it('handles unparseable bidDueDate as NO_DATE', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [est({ id: 'gibberish', bidDueDate: 'sometime soon ish' })],
    });
    expect(r.rows[0]?.urgency).toBe('NO_DATE');
  });

  it('rolls up bid total per estimate', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({
          bidItems: [
            { description: 'a', quantity: 2, unitPriceCents: 100_00, unit: 'LS' } as never,
            { description: 'b', quantity: 1, unitPriceCents: 300_00, unit: 'LS' } as never,
          ],
          oppPercent: 0.2,
        }),
      ],
    });
    // direct = 2*100 + 1*300 = 500. opp = 100. bidTotal = 600.
    expect(r.rows[0]?.bidTotalCents).toBe(600_00);
  });

  it('hotPipelineCents = OVERDUE + TODAY + THIS_WEEK only', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({ id: 'hot1', bidDueDate: '2026-04-20', bidItems: [{ description: 'x', quantity: 1, unitPriceCents: 100_00, unit: 'LS' } as never] }),
        est({ id: 'hot2', bidDueDate: '2026-04-30', bidItems: [{ description: 'x', quantity: 1, unitPriceCents: 200_00, unit: 'LS' } as never] }),
        est({ id: 'cold', bidDueDate: '2026-06-01', bidItems: [{ description: 'x', quantity: 1, unitPriceCents: 99_999_00, unit: 'LS' } as never] }),
      ],
    });
    // hot1 (100*1.2) + hot2 (200*1.2) = 120+240 = 360
    expect(r.rollup.hotPipelineCents).toBe(360_00);
  });

  it('sorts OVERDUE first (most overdue), then by date asc within tier', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({ id: 'a', bidDueDate: '2026-05-08' }), // NEXT_WEEK
        est({ id: 'b', bidDueDate: '2026-04-15' }), // OVERDUE 12 days
        est({ id: 'c', bidDueDate: '2026-04-25' }), // OVERDUE 2 days
        est({ id: 'd', bidDueDate: '2026-04-30' }), // THIS_WEEK
      ],
    });
    expect(r.rows.map((x) => x.estimateId)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('NO_DATE pinned to bottom', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({ id: 'nodate' }),
        est({ id: 'later', bidDueDate: '2026-06-01' }),
      ],
    });
    expect(r.rows.map((x) => x.estimateId)).toEqual(['later', 'nodate']);
  });

  it('rollup byUrgency tally', () => {
    const r = buildBidPursuitPipeline({
      asOf: '2026-04-27',
      estimates: [
        est({ id: '1', bidDueDate: '2026-04-15' }), // OVERDUE
        est({ id: '2', bidDueDate: '2026-04-15' }), // OVERDUE
        est({ id: '3', bidDueDate: '2026-04-30' }), // THIS_WEEK
        est({ id: '4' }),                            // NO_DATE
      ],
    });
    expect(r.rollup.byUrgency.OVERDUE).toBe(2);
    expect(r.rollup.byUrgency.THIS_WEEK).toBe(1);
    expect(r.rollup.byUrgency.NO_DATE).toBe(1);
  });
});
