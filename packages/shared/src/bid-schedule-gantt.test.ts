// Coverage for the bid-schedule Gantt builder.

import { describe, it, expect } from 'vitest';
import { buildBidGantt } from './bid-schedule-gantt';
import type { PtoEBidItem } from './plans-to-estimate-output';

function item(over: Partial<PtoEBidItem>): PtoEBidItem {
  return {
    itemNumber: '1',
    description: 'Item',
    unit: 'LS',
    quantity: 1,
    confidence: 'MEDIUM',
    ...over,
  };
}

describe('buildBidGantt', () => {
  it('prepends MOB and appends DEMOB when missing', () => {
    const r = buildBidGantt({
      bidItems: [
        item({
          itemNumber: '1',
          description: 'Excavation',
          unit: 'CY',
          quantity: 200,
        }),
      ],
    });
    expect(r.tasks.some((t) => t.group === 'MOB')).toBe(true);
    expect(r.tasks.some((t) => t.group === 'DEMOB')).toBe(true);
  });

  it('sequences groups: earthwork ends before utility starts', () => {
    const r = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 1000 }),
        item({ itemNumber: '2', description: 'PVC conduit trench + lay', unit: 'LF', quantity: 500 }),
      ],
    });
    const earth = r.tasks.find((t) => t.group === 'EARTHWORK')!;
    const util = r.tasks.find((t) => t.group === 'UTILITY')!;
    expect(util.startDay).toBeGreaterThanOrEqual(earth.endDay);
  });

  it('parallelizes within a group — multiple earthwork items share a start day', () => {
    const r = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 500 }),
        item({
          itemNumber: '2',
          description: 'Structural fill 95% compaction',
          unit: 'CY',
          quantity: 800,
        }),
      ],
    });
    const earth = r.tasks.filter((t) => t.group === 'EARTHWORK');
    expect(earth.length).toBe(2);
    expect(earth[0]!.startDay).toBe(earth[1]!.startDay);
  });

  it('LIVE-site multiplier roughly 1.7× the GREENFIELD duration', () => {
    const make = (cond: 'GREENFIELD' | 'LIVE') =>
      buildBidGantt({
        siteCondition: cond,
        bidItems: [
          item({
            itemNumber: '1',
            description: 'PVC conduit trench + lay + backfill',
            unit: 'LF',
            quantity: 2000,
          }),
        ],
      });
    const g = make('GREENFIELD');
    const l = make('LIVE');
    const gUtil = g.tasks.find((t) => t.group === 'UTILITY')!;
    const lUtil = l.tasks.find((t) => t.group === 'UTILITY')!;
    expect(lUtil.durationDays / gUtil.durationDays).toBeGreaterThan(1.4);
    expect(lUtil.durationDays / gUtil.durationDays).toBeLessThan(2.0);
  });

  it('totalDays adds inspection-hold drag per group when supplied', () => {
    const noHolds = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 500 }),
      ],
    });
    const withHolds = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 500 }),
      ],
      groupInspectionHoldDays: { EARTHWORK: 5 },
    });
    expect(withHolds.totalDays - noHolds.totalDays).toBe(5);
  });

  it('marks the longest item in a group as critical, shorter ones as not', () => {
    const r = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        // Big quantity → longer duration → critical
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 5000 }),
        // Small quantity → shorter duration → parallel slack
        item({
          itemNumber: '2',
          description: 'Fine grade subgrade',
          unit: 'SF',
          quantity: 2000,
        }),
      ],
    });
    const big = r.tasks.find((t) => t.itemNumber === '1')!;
    const small = r.tasks.find((t) => t.itemNumber === '2')!;
    expect(big.onCriticalPath).toBe(true);
    expect(small.onCriticalPath).toBe(false);
  });

  it('items with no matching rate still produce a 5-day placeholder task', () => {
    const r = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({
          itemNumber: '1',
          description: 'Exotic widget that has no rate match',
          unit: 'EA',
          quantity: 1,
        }),
      ],
    });
    const widget = r.tasks.find((t) => t.itemNumber === '1')!;
    expect(widget.durationDays).toBe(5);
    expect(widget.rateNote).toContain('no matching production rate');
  });

  it('zero-quantity items are skipped', () => {
    const r = buildBidGantt({
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 0 }),
      ],
    });
    expect(r.tasks.find((t) => t.itemNumber === '1')).toBeUndefined();
    // MOB + DEMOB still get inserted.
    expect(r.tasks.length).toBe(2);
  });

  it('end-to-end: NTP → demob total days monotonically increases each group', () => {
    const r = buildBidGantt({
      siteCondition: 'GREENFIELD',
      bidItems: [
        item({ itemNumber: '1', description: 'Excavation', unit: 'CY', quantity: 1000 }),
        item({
          itemNumber: '2',
          description: 'PVC conduit trench + lay',
          unit: 'LF',
          quantity: 800,
        }),
        item({
          itemNumber: '3',
          description: 'Equipment foundation pour',
          unit: 'CY',
          quantity: 40,
        }),
        item({
          itemNumber: '4',
          description: 'AC paving Type A 3-inch lift',
          unit: 'TON',
          quantity: 600,
        }),
      ],
    });
    const spans = r.groupSpans;
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]!.startDay).toBeGreaterThanOrEqual(spans[i - 1]!.endDay);
    }
    // Total = end of last group span.
    expect(r.totalDays).toBe(spans[spans.length - 1]!.endDay);
  });
});
