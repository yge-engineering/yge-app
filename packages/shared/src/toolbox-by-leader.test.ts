import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildToolboxByLeader } from './toolbox-by-leader';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    heldOn: '2026-04-15',
    topic: 'Trenching safety',
    leaderName: 'Brook Young',
    attendees: [],
    status: 'SUBMITTED',
    ...over,
  } as ToolboxTalk;
}

describe('buildToolboxByLeader', () => {
  it('groups talks by leader (case-insensitive)', () => {
    const r = buildToolboxByLeader({
      toolboxTalks: [
        tbt({ id: 'a', leaderName: 'Brook Young' }),
        tbt({ id: 'b', leaderName: 'BROOK YOUNG' }),
        tbt({ id: 'c', leaderName: 'brook young' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.talks).toBe(3);
  });

  it('counts distinct topics + jobs per leader', () => {
    const r = buildToolboxByLeader({
      toolboxTalks: [
        tbt({ id: 'a', topic: 'Trenching', jobId: 'j1' }),
        tbt({ id: 'b', topic: 'Trenching', jobId: 'j2' }),
        tbt({ id: 'c', topic: 'PPE', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums attendees + signed attendees', () => {
    const r = buildToolboxByLeader({
      toolboxTalks: [
        tbt({
          id: 'a',
          attendees: [
            { name: 'Joe', signed: true },
            { name: 'Mary', signed: false },
          ],
        }),
        tbt({
          id: 'b',
          attendees: [
            { name: 'Pete', signed: true },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalAttendees).toBe(3);
    expect(r.rows[0]?.signedAttendees).toBe(2);
  });

  it('tracks last heldOn date', () => {
    const r = buildToolboxByLeader({
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-04-10' }),
        tbt({ id: 'b', heldOn: '2026-04-20' }),
        tbt({ id: 'c', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastHeldOn).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildToolboxByLeader({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      toolboxTalks: [
        tbt({ id: 'old', heldOn: '2026-03-15' }),
        tbt({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTalks).toBe(1);
  });

  it('sorts leaders by talks desc', () => {
    const r = buildToolboxByLeader({
      toolboxTalks: [
        tbt({ id: 's', leaderName: 'Small' }),
        tbt({ id: 'b1', leaderName: 'Big' }),
        tbt({ id: 'b2', leaderName: 'Big' }),
      ],
    });
    expect(r.rows[0]?.leaderName).toBe('Big');
  });

  it('handles empty input', () => {
    const r = buildToolboxByLeader({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
