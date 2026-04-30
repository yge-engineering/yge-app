import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildPortfolioPunchSnapshot } from './portfolio-punch-snapshot';

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

describe('buildPortfolioPunchSnapshot', () => {
  it('counts by status + open vs closed', () => {
    const r = buildPortfolioPunchSnapshot({
      asOf: '2026-04-30',
      punchItems: [
        pi({ id: 'a', status: 'OPEN' }),
        pi({ id: 'b', status: 'IN_PROGRESS' }),
        pi({ id: 'c', status: 'CLOSED' }),
        pi({ id: 'd', status: 'WAIVED' }),
        pi({ id: 'e', status: 'DISPUTED' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.closedCount).toBe(2);
    expect(r.byStatus.OPEN).toBe(1);
    expect(r.byStatus.IN_PROGRESS).toBe(1);
    expect(r.byStatus.DISPUTED).toBe(1);
  });

  it('breaks open items by severity', () => {
    const r = buildPortfolioPunchSnapshot({
      asOf: '2026-04-30',
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
    const r = buildPortfolioPunchSnapshot({
      asOf: '2026-06-30',
      punchItems: [
        pi({ id: 'a', status: 'OPEN', identifiedOn: '2026-06-25' }),
        pi({ id: 'b', status: 'OPEN', identifiedOn: '2026-04-25' }),
      ],
    });
    expect(r.oldestOpenAgeDays).toBeGreaterThan(60);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioPunchSnapshot({
      asOf: '2026-04-30',
      punchItems: [
        pi({ id: 'a', jobId: 'j1' }),
        pi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPunchSnapshot({ punchItems: [] });
    expect(r.totalItems).toBe(0);
  });
});
