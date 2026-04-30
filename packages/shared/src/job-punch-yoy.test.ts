import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildJobPunchYoy } from './job-punch-yoy';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'T',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildJobPunchYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobPunchYoy({
      jobId: 'j1',
      currentYear: 2026,
      punchItems: [
        pi({ id: 'a', identifiedOn: '2025-04-15', status: 'CLOSED' }),
        pi({ id: 'b', identifiedOn: '2026-04-15', status: 'OPEN' }),
        pi({ id: 'c', identifiedOn: '2026-04-22', status: 'IN_PROGRESS' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentOpen).toBe(2);
  });

  it('handles unknown job', () => {
    const r = buildJobPunchYoy({ jobId: 'X', currentYear: 2026, punchItems: [] });
    expect(r.priorTotal).toBe(0);
  });
});
