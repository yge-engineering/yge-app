import { describe, it, expect } from 'vitest';
import {
  CashFlowItemSchema,
  buildCashRunway,
  type CashFlowItem,
} from './cash-runway';

function item(over: Partial<CashFlowItem>): CashFlowItem {
  return CashFlowItemSchema.parse({
    id: 'i',
    kind: 'INFLOW',
    expectedOn: '2026-05-22',
    amountCents: 100_000_00,
    description: 'AR clear',
    ...over,
  });
}

describe('buildCashRunway — basic', () => {
  it('returns the requested number of weeks', () => {
    const r = buildCashRunway({
      startingBalanceCents: 500_000_00,
      asOfDate: '2026-05-22',
      horizonWeeks: 4,
      items: [],
    });
    expect(r.weeks).toHaveLength(4);
  });

  it('first week starts on the Monday of asOfDate (asOf Fri)', () => {
    const r = buildCashRunway({
      startingBalanceCents: 100_00,
      asOfDate: '2026-05-22', // Friday
      horizonWeeks: 1,
      items: [],
    });
    expect(r.weeks[0]!.weekStarting).toBe('2026-05-18');
    expect(r.weeks[0]!.weekEnding).toBe('2026-05-24');
  });

  it('throws on horizonWeeks <= 0', () => {
    expect(() =>
      buildCashRunway({
        startingBalanceCents: 0,
        asOfDate: '2026-05-22',
        horizonWeeks: 0,
        items: [],
      }),
    ).toThrow();
  });
});

describe('buildCashRunway — flow math', () => {
  it('rolls inflows + outflows through running balance', () => {
    const r = buildCashRunway({
      startingBalanceCents: 100_000_00,
      asOfDate: '2026-05-18',
      horizonWeeks: 3,
      items: [
        item({ id: 'a', kind: 'INFLOW', expectedOn: '2026-05-20', amountCents: 50_000_00 }),
        item({ id: 'b', kind: 'OUTFLOW', expectedOn: '2026-05-25', amountCents: 30_000_00 }),
        item({ id: 'c', kind: 'OUTFLOW', expectedOn: '2026-06-01', amountCents: 80_000_00 }),
      ],
    });
    expect(r.weeks[0]!.endingBalanceCents).toBe(150_000_00);
    expect(r.weeks[1]!.endingBalanceCents).toBe(120_000_00);
    expect(r.weeks[2]!.endingBalanceCents).toBe(40_000_00);
    expect(r.endingBalanceCents).toBe(40_000_00);
    expect(r.totalInflowCents).toBe(50_000_00);
    expect(r.totalOutflowCents).toBe(110_000_00);
  });

  it('marks the lowest week with isLowest = true', () => {
    const r = buildCashRunway({
      startingBalanceCents: 100_000_00,
      asOfDate: '2026-05-18',
      horizonWeeks: 4,
      items: [
        item({ id: 'big-out', kind: 'OUTFLOW', expectedOn: '2026-05-26', amountCents: 90_000_00 }),
        item({ id: 'recovery', kind: 'INFLOW', expectedOn: '2026-06-05', amountCents: 50_000_00 }),
      ],
    });
    const lowest = r.weeks.find((w) => w.isLowest)!;
    expect(lowest.weekStarting).toBe('2026-05-25');
    expect(r.lowestBalanceCents).toBe(10_000_00);
    expect(r.weeksUntilLowest).toBe(1);
  });

  it('finds the first week balance went negative', () => {
    const r = buildCashRunway({
      startingBalanceCents: 50_00,
      asOfDate: '2026-05-18',
      horizonWeeks: 2,
      items: [item({ id: 'a', kind: 'OUTFLOW', expectedOn: '2026-05-20', amountCents: 100_00 })],
    });
    expect(r.firstNegativeWeek).toBe('2026-05-18');
  });

  it('reports null firstNegativeWeek when nothing went negative', () => {
    const r = buildCashRunway({
      startingBalanceCents: 100_000_00,
      asOfDate: '2026-05-18',
      horizonWeeks: 4,
      items: [item({ id: 'a', kind: 'INFLOW', expectedOn: '2026-05-20', amountCents: 1_000_00 })],
    });
    expect(r.firstNegativeWeek).toBeNull();
  });
});

describe('buildCashRunway — items in week', () => {
  it('attaches the in-window items to each week sorted by date', () => {
    const r = buildCashRunway({
      startingBalanceCents: 0,
      asOfDate: '2026-05-18',
      horizonWeeks: 1,
      items: [
        item({ id: 'b', expectedOn: '2026-05-22' }),
        item({ id: 'a', expectedOn: '2026-05-19' }),
      ],
    });
    expect(r.weeks[0]!.items.map((it) => it.id)).toEqual(['a', 'b']);
  });
});
