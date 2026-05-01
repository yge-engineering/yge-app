import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildJobToolboxDetailSnapshot } from './job-toolbox-detail-snapshot';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-13',
    topic: 'Trenching',
    leaderName: 'Mike',
    attendees: [],
    status: 'HELD',
    jobId: 'j1',
    ...over,
  } as ToolboxTalk;
}

describe('buildJobToolboxDetailSnapshot', () => {
  it('returns one row per leader sorted by meetings', () => {
    const r = buildJobToolboxDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1', leaderName: 'Mike', topic: 'Trenching', heldOn: '2026-04-13', attendees: [{ name: 'Pat', signed: true }, { name: 'Sam', signed: false }] }),
        tb({ id: 'b', jobId: 'j1', leaderName: 'Mike', topic: 'Heat', heldOn: '2026-04-20', attendees: [{ name: 'Pat', signed: true }] }),
        tb({ id: 'c', jobId: 'j1', leaderName: 'Joe', topic: 'Trenching', heldOn: '2026-04-15', attendees: [{ name: 'Lee', signed: true }] }),
        tb({ id: 'd', jobId: 'j2', leaderName: 'Mike' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.leaderName).toBe('Mike');
    expect(r.rows[0]?.meetings).toBe(2);
    expect(r.rows[0]?.totalAttendees).toBe(3);
    expect(r.rows[0]?.signedAttendees).toBe(2);
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[1]?.leaderName).toBe('Joe');
    expect(r.rows[1]?.meetings).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobToolboxDetailSnapshot({ jobId: 'X', toolboxTalks: [] });
    expect(r.rows.length).toBe(0);
  });
});
