import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildJobToolboxSummary } from './job-toolbox-summary';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Trenching',
    leaderName: 'Brook',
    attendees: [],
    status: 'SUBMITTED',
    ...over,
  } as ToolboxTalk;
}

describe('buildJobToolboxSummary', () => {
  it('groups talks by jobId', () => {
    const r = buildJobToolboxSummary({
      toolboxTalks: [
        tbt({ id: 'a', jobId: 'j1' }),
        tbt({ id: 'b', jobId: 'j1' }),
        tbt({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts distinct topics and leaders per job', () => {
    const r = buildJobToolboxSummary({
      toolboxTalks: [
        tbt({ id: 'a', topic: 'Trenching', leaderName: 'Brook' }),
        tbt({ id: 'b', topic: 'PPE', leaderName: 'Brook' }),
        tbt({ id: 'c', topic: 'Trenching', leaderName: 'Ryan' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctLeaders).toBe(2);
  });

  it('sums attendees and signed', () => {
    const r = buildJobToolboxSummary({
      toolboxTalks: [
        tbt({ id: 'a', attendees: [{ name: 'Joe', signed: true }, { name: 'Mary', signed: false }] }),
        tbt({ id: 'b', attendees: [{ name: 'Pete', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.totalAttendees).toBe(3);
    expect(r.rows[0]?.signedAttendees).toBe(2);
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildJobToolboxSummary({
      toolboxTalks: [
        tbt({ id: 'a', jobId: 'j1' }),
        tbt({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by lastHeldOn desc', () => {
    const r = buildJobToolboxSummary({
      toolboxTalks: [
        tbt({ id: 'old', jobId: 'old', heldOn: '2026-04-01' }),
        tbt({ id: 'recent', jobId: 'recent', heldOn: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('recent');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobToolboxSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      toolboxTalks: [
        tbt({ id: 'old', heldOn: '2026-03-15' }),
        tbt({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTalks).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildJobToolboxSummary({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
