import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildPortfolioToolboxSnapshot } from './portfolio-toolbox-snapshot';

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

describe('buildPortfolioToolboxSnapshot', () => {
  it('counts total + ytd', () => {
    const r = buildPortfolioToolboxSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
        tb({ id: 'c', heldOn: '2026-04-22' }),
      ],
    });
    expect(r.totalTalks).toBe(3);
    expect(r.ytdTalks).toBe(2);
  });

  it('counts distinct topics + leaders + jobs', () => {
    const r = buildPortfolioToolboxSnapshot({
      asOf: '2026-04-30',
      toolboxTalks: [
        tb({ id: 'a', topic: 'Heat', leaderName: 'Pat', jobId: 'j1' }),
        tb({ id: 'b', topic: 'Trenching', leaderName: 'Sam', jobId: 'j2' }),
      ],
    });
    expect(r.distinctTopics).toBe(2);
    expect(r.distinctLeaders).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('counts total + signed attendees', () => {
    const r = buildPortfolioToolboxSnapshot({
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

  it('ignores talks after asOf', () => {
    const r = buildPortfolioToolboxSnapshot({
      asOf: '2026-04-30',
      toolboxTalks: [tb({ id: 'late', heldOn: '2026-05-15' })],
    });
    expect(r.totalTalks).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioToolboxSnapshot({ toolboxTalks: [] });
    expect(r.totalTalks).toBe(0);
  });
});
