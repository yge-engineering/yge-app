import { describe, expect, it } from 'vitest';

import type { ToolboxTalk } from './toolbox-talk';

import { buildJobToolboxYoy } from './job-toolbox-yoy';

function tb(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tb-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-15',
    jobId: 'j1',
    topic: 'Heat',
    leaderName: 'Pat',
    attendees: [
      { name: 'A', signed: true },
      { name: 'B', signed: false },
    ],
    ...over,
  } as ToolboxTalk;
}

describe('buildJobToolboxYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobToolboxYoy({
      jobId: 'j1',
      currentYear: 2026,
      toolboxTalks: [
        tb({ id: 'a', heldOn: '2025-04-15' }),
        tb({ id: 'b', heldOn: '2026-04-15' }),
        tb({ id: 'c', heldOn: '2026-08-15', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorTotalAttendees).toBe(2);
    expect(r.currentSignedAttendees).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobToolboxYoy({ jobId: 'X', currentYear: 2026, toolboxTalks: [] });
    expect(r.priorTotal).toBe(0);
  });
});
