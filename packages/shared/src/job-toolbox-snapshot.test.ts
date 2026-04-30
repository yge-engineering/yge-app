import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildJobToolboxSnapshot } from './job-toolbox-snapshot';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildJobToolboxSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobToolboxSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', jobId: 'j1' }),
        tb({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalTalks).toBe(1);
  });

  it('counts ytd', () => {
    const r = buildJobToolboxSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      logYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.ytdTalks).toBe(1);
  });

  it('counts distinct topics + leaders', () => {
    const r = buildJobToolboxSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', topic: 'Heat illness', leaderName: 'Pat' }),
        tb({ id: 'b', topic: 'HEAT ILLNESS', leaderName: 'PAT' }),
        tb({ id: 'c', topic: 'Trenching', leaderName: 'Sam' }),
      ],
    });
    expect(r.distinctTopics).toBe(2);
    expect(r.distinctLeaders).toBe(2);
  });

  it('counts total + signed attendees', () => {
    const r = buildJobToolboxSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
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
    expect(r.totalAttendees).toBe(3);
    expect(r.signedAttendees).toBe(2);
  });

  it('tracks last talk date', () => {
    const r = buildJobToolboxSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2026-04-08' }),
        tb({ id: 'b', heldOn: '2026-04-22' }),
      ],
    });
    expect(r.lastTalkDate).toBe('2026-04-22');
  });

  it('handles no matching talks', () => {
    const r = buildJobToolboxSnapshot({ jobId: 'j1', toolboxTalks: [] });
    expect(r.totalTalks).toBe(0);
    expect(r.lastTalkDate).toBeNull();
  });
});
