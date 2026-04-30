import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildJobPunchSnapshot } from './job-punch-snapshot';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'Test',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildJobPunchSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobPunchSnapshot({
      jobId: 'j1',
      punchItems: [
        pi({ id: 'a', jobId: 'j1' }),
        pi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalItems).toBe(1);
  });

  it('counts open vs closed', () => {
    const r = buildJobPunchSnapshot({
      jobId: 'j1',
      punchItems: [
        pi({ id: 'a', status: 'OPEN' }),
        pi({ id: 'b', status: 'IN_PROGRESS' }),
        pi({ id: 'c', status: 'CLOSED' }),
        pi({ id: 'd', status: 'WAIVED' }),
        pi({ id: 'e', status: 'DISPUTED' }),
      ],
    });
    expect(r.openCount).toBe(3);
    expect(r.closedCount).toBe(2);
  });

  it('breaks open by severity', () => {
    const r = buildJobPunchSnapshot({
      jobId: 'j1',
      punchItems: [
        pi({ id: 'a', status: 'OPEN', severity: 'SAFETY' }),
        pi({ id: 'b', status: 'OPEN', severity: 'MAJOR' }),
        pi({ id: 'c', status: 'CLOSED', severity: 'MAJOR' }),
      ],
    });
    expect(r.openBySeverity.SAFETY).toBe(1);
    expect(r.openBySeverity.MAJOR).toBe(1);
  });

  it('tracks oldest open item age', () => {
    const r = buildJobPunchSnapshot({
      jobId: 'j1',
      asOf: '2026-06-30',
      punchItems: [
        pi({ id: 'a', status: 'OPEN', identifiedOn: '2026-06-25' }),
        pi({ id: 'b', status: 'OPEN', identifiedOn: '2026-04-25' }),
      ],
    });
    expect(r.oldestOpenAgeDays ?? 0).toBeGreaterThan(60);
  });

  it('counts distinct locations (case-insensitive)', () => {
    const r = buildJobPunchSnapshot({
      jobId: 'j1',
      punchItems: [
        pi({ id: 'a', location: 'Bay 1' }),
        pi({ id: 'b', location: 'BAY 1' }),
        pi({ id: 'c', location: 'Bay 2' }),
      ],
    });
    expect(r.distinctLocations).toBe(2);
  });

  it('handles no matching items', () => {
    const r = buildJobPunchSnapshot({ jobId: 'j1', punchItems: [] });
    expect(r.totalItems).toBe(0);
  });
});
