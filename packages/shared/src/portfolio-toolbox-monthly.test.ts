import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildPortfolioToolboxMonthly } from './portfolio-toolbox-monthly';

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

describe('buildPortfolioToolboxMonthly', () => {
  it('counts distinct topics + leaders + attendees + jobs', () => {
    const r = buildPortfolioToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', topic: 'Heat illness', leaderName: 'Pat', jobId: 'j1' }),
        tb({ id: 'b', topic: 'Trenching', leaderName: 'Sam', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctTopics).toBe(2);
    expect(r.rows[0]?.distinctLeaders).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.totalAttendees).toBe(4);
    expect(r.rows[0]?.signedAttendees).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioToolboxMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      toolboxTalks: [
        tb({ id: 'old', heldOn: '2026-03-15' }),
        tb({ id: 'in', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTalks).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioToolboxMonthly({
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2026-06-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioToolboxMonthly({ toolboxTalks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
