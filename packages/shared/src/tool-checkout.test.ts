import { describe, expect, it } from 'vitest';
import { buildToolCheckout } from './tool-checkout';
import type { Tool } from './tool';

function tool(over: Partial<Tool>): Tool {
  return {
    id: 'tool-1',
    createdAt: '',
    updatedAt: '',
    name: 'Drill',
    category: 'DRILL',
    status: 'IN_YARD',
    ...over,
  } as Tool;
}

describe('buildToolCheckout', () => {
  it('IN_YARD or IN_SHOP → IN_YARD_OK', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({ id: 'a', status: 'IN_YARD' }),
        tool({ id: 'b', status: 'IN_SHOP' }),
      ],
    });
    expect(r.rows.every((x) => x.tier === 'IN_YARD_OK')).toBe(true);
  });

  it('CHECKED_OUT for <30 days assigned', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({
          status: 'ASSIGNED',
          assignedAt: '2026-04-10T00:00:00Z',
          assignedToEmployeeId: 'emp-bob',
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('CHECKED_OUT');
    expect(r.rows[0]?.daysAssigned).toBe(17);
  });

  it('AGED_30 for 30-59 days', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({
          status: 'ASSIGNED',
          assignedAt: '2026-03-15T00:00:00Z',
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('AGED_30');
  });

  it('AGED_60 for 60+ days', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({
          status: 'ASSIGNED',
          assignedAt: '2026-02-01T00:00:00Z',
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('AGED_60');
  });

  it('LOST + OUT_FOR_REPAIR → LOST_OR_REPAIR', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({ id: 'lost', status: 'LOST' }),
        tool({ id: 'repair', status: 'OUT_FOR_REPAIR' }),
      ],
    });
    expect(r.rows.every((x) => x.tier === 'LOST_OR_REPAIR')).toBe(true);
  });

  it('skips RETIRED', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({ id: 'live', status: 'IN_YARD' }),
        tool({ id: 'dead', status: 'RETIRED' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts AGED_60 first, then LOST_OR_REPAIR, AGED_30, CHECKED_OUT, IN_YARD_OK', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({ id: 'inyard', status: 'IN_YARD' }),
        tool({ id: 'aged60', status: 'ASSIGNED', assignedAt: '2026-01-01T00:00:00Z' }),
        tool({ id: 'aged30', status: 'ASSIGNED', assignedAt: '2026-03-15T00:00:00Z' }),
        tool({ id: 'lost', status: 'LOST' }),
        tool({ id: 'co', status: 'ASSIGNED', assignedAt: '2026-04-10T00:00:00Z' }),
      ],
    });
    expect(r.rows.map((x) => x.toolId)).toEqual([
      'aged60',
      'lost',
      'aged30',
      'co',
      'inyard',
    ]);
  });

  it('rollup tally', () => {
    const r = buildToolCheckout({
      asOf: '2026-04-27',
      tools: [
        tool({ id: '1', status: 'IN_YARD' }),
        tool({ id: '2', status: 'IN_YARD' }),
        tool({ id: '3', status: 'ASSIGNED', assignedAt: '2026-04-15T00:00:00Z' }),
        tool({ id: '4', status: 'LOST' }),
      ],
    });
    expect(r.rollup.total).toBe(4);
    expect(r.rollup.inYard).toBe(2);
    expect(r.rollup.checkedOut).toBe(1);
    expect(r.rollup.lostOrRepair).toBe(1);
  });
});
