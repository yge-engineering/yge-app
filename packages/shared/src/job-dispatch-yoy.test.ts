import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobDispatchYoy } from './job-dispatch-yoy';

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [{ name: 'A' }, { name: 'B' }],
    equipment: [{ name: 'X' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobDispatchYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobDispatchYoy({
      jobId: 'j1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', scheduledFor: '2026-04-15' }),
        dp({ id: 'c', scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
  });

  it('handles unknown job', () => {
    const r = buildJobDispatchYoy({ jobId: 'X', currentYear: 2026, dispatches: [] });
    expect(r.priorTotal).toBe(0);
  });
});
