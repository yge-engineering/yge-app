import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildToolboxTopicRecency } from './toolbox-topic-recency';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    heldOn: '2026-04-15',
    topic: 'Trenching safety',
    attendees: [
      { name: 'Alice', signed: true },
      { name: 'Bob', signed: true },
    ],
    status: 'HELD',
    ...over,
  } as ToolboxTalk;
}

describe('buildToolboxTopicRecency', () => {
  it('groups by canonical topic (case + whitespace insensitive)', () => {
    const r = buildToolboxTopicRecency({
      talks: [
        tbt({ id: 'a', topic: 'Trenching Safety' }),
        tbt({ id: 'b', topic: 'trenching safety' }),
        tbt({ id: 'c', topic: ' TRENCHING  SAFETY ' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.sessionCount).toBe(3);
  });

  it('captures first / last held date + days since', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [
        tbt({ id: 'old', heldOn: '2026-01-15' }),
        tbt({ id: 'new', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstHeldOn).toBe('2026-01-15');
    expect(r.rows[0]?.lastHeldOn).toBe('2026-04-15');
    expect(r.rows[0]?.daysSinceLastHeld).toBe(15);
  });

  it('flags FRESH when within 30 days', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [tbt({ heldOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.flag).toBe('FRESH');
  });

  it('flags DUE_SOON between 30 and 60 days', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [tbt({ heldOn: '2026-03-15' })], // 46 days
    });
    expect(r.rows[0]?.flag).toBe('DUE_SOON');
  });

  it('flags STALE between 60 and 120 days', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [tbt({ heldOn: '2026-01-15' })], // 105 days
    });
    expect(r.rows[0]?.flag).toBe('STALE');
  });

  it('flags COLD beyond 120 days', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [tbt({ heldOn: '2025-10-15' })], // ~197 days
    });
    expect(r.rows[0]?.flag).toBe('COLD');
  });

  it('skips DRAFT talks', () => {
    const r = buildToolboxTopicRecency({
      talks: [
        tbt({ id: 'a', status: 'DRAFT' }),
        tbt({ id: 'b', status: 'HELD' }),
      ],
    });
    expect(r.rows[0]?.sessionCount).toBe(1);
  });

  it('counts attendees + computes average', () => {
    const r = buildToolboxTopicRecency({
      talks: [
        tbt({ id: 'a', attendees: [
          { name: 'a1', signed: true }, { name: 'a2', signed: true }, { name: 'a3', signed: true },
        ] }),
        tbt({ id: 'b', heldOn: '2026-04-22', attendees: [
          { name: 'b1', signed: true }, { name: 'b2', signed: true }, { name: 'b3', signed: true },
          { name: 'b4', signed: true }, { name: 'b5', signed: true }, { name: 'b6', signed: true }, { name: 'b7', signed: true },
        ] }),
      ],
    });
    expect(r.rows[0]?.totalAttendees).toBe(10);
    expect(r.rows[0]?.avgAttendees).toBe(5);
  });

  it('respects window bounds', () => {
    const r = buildToolboxTopicRecency({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      talks: [
        tbt({ id: 'old', topic: 'Old topic', heldOn: '2026-01-15' }),
        tbt({ id: 'in', topic: 'In topic', heldOn: '2026-04-15' }),
        tbt({ id: 'after', topic: 'After topic', heldOn: '2026-05-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.topicDisplay).toBe('In topic');
  });

  it('sorts coldest topics first', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [
        tbt({ id: 'fresh', topic: 'Fresh', heldOn: '2026-04-25' }),
        tbt({ id: 'cold', topic: 'Cold', heldOn: '2025-10-15' }),
        tbt({ id: 'mid', topic: 'Mid', heldOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.topicDisplay).toBe('Cold');
    expect(r.rows[1]?.topicDisplay).toBe('Mid');
    expect(r.rows[2]?.topicDisplay).toBe('Fresh');
  });

  it('rolls up flag tier counts', () => {
    const r = buildToolboxTopicRecency({
      asOf: '2026-04-30',
      talks: [
        tbt({ id: 'f', topic: 'Fresh', heldOn: '2026-04-25' }),
        tbt({ id: 's', topic: 'Stale', heldOn: '2026-01-15' }),
        tbt({ id: 'c', topic: 'Cold', heldOn: '2025-10-15' }),
      ],
    });
    expect(r.rollup.fresh).toBe(1);
    expect(r.rollup.stale).toBe(1);
    expect(r.rollup.cold).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildToolboxTopicRecency({ talks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
