import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildJobToolboxMonthly } from './job-toolbox-monthly';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Heat illness',
    leaderName: 'Pat',
    attendees: [
      { name: 'A', signed: true },
      { name: 'B', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

describe('buildJobToolboxMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1', heldOn: '2026-04-01' }),
        tb({ id: 'b', jobId: 'j1', heldOn: '2026-05-01' }),
        tb({ id: 'c', jobId: 'j2', heldOn: '2026-04-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts talks per (job, month)', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a' }),
        tb({ id: 'b' }),
        tb({ id: 'c' }),
      ],
    });
    expect(r.rows[0]?.talks).toBe(3);
  });

  it('counts distinct topics + leaders', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', topic: 'Heat illness', leaderName: 'Pat' }),
        tb({ id: 'b', topic: 'Trenching', leaderName: 'Pat' }),
        tb({ id: 'c', topic: 'Heat illness', leaderName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctLeaders).toBe(2);
  });

  it('sums attendee + signed counts', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({
          id: 'a',
          attendees: [
            { name: 'A', signed: true },
            { name: 'B', signed: true },
            { name: 'C', signed: false },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalAttendees).toBe(3);
    expect(r.rows[0]?.signedAttendees).toBe(2);
  });

  it('counts unattributed talks (no jobId)', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1' }),
        tb({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildJobToolboxMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      toolboxTalks: [
        tb({ id: 'old', heldOn: '2026-03-15' }),
        tb({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTalks).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', jobId: 'Z', heldOn: '2026-04-15' }),
        tb({ id: 'b', jobId: 'A', heldOn: '2026-05-01' }),
        tb({ id: 'c', jobId: 'A', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobToolboxMonthly({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalTalks).toBe(0);
  });
});
