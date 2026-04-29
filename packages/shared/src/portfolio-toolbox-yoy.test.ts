import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildPortfolioToolboxYoy } from './portfolio-toolbox-yoy';

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

describe('buildPortfolioToolboxYoy', () => {
  it('compares prior vs current year', () => {
    const r = buildPortfolioToolboxYoy({
      currentYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
        tb({ id: 'c', heldOn: '2026-05-15' }),
      ],
    });
    expect(r.priorTalks).toBe(1);
    expect(r.currentTalks).toBe(2);
    expect(r.talksDelta).toBe(1);
  });

  it('counts distinct topics + leaders + attendees per year', () => {
    const r = buildPortfolioToolboxYoy({
      currentYear: 2026,
      toolboxTalks: [
        tb({
          id: 'a',
          heldOn: '2025-04-15',
          topic: 'Heat',
          leaderName: 'Pat',
          attendees: [{ name: 'A', signed: true }],
        }),
        tb({
          id: 'b',
          heldOn: '2026-04-15',
          topic: 'Trenching',
          leaderName: 'Sam',
          attendees: [
            { name: 'B', signed: true },
            { name: 'C', signed: false },
          ],
        }),
      ],
    });
    expect(r.priorDistinctTopics).toBe(1);
    expect(r.currentDistinctTopics).toBe(1);
    expect(r.priorTotalAttendees).toBe(1);
    expect(r.currentTotalAttendees).toBe(2);
    expect(r.currentSignedAttendees).toBe(1);
  });

  it('ignores talks outside the two-year window', () => {
    const r = buildPortfolioToolboxYoy({
      currentYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2024-04-15' }),
      ],
    });
    expect(r.priorTalks).toBe(0);
    expect(r.currentTalks).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioToolboxYoy({ currentYear: 2026, toolboxTalks: [] });
    expect(r.priorTalks).toBe(0);
    expect(r.currentTalks).toBe(0);
  });
});
