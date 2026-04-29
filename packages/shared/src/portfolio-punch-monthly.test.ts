import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildPortfolioPunchMonthly } from './portfolio-punch-monthly';

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

describe('buildPortfolioPunchMonthly', () => {
  it('counts identified + closed in their respective months', () => {
    const r = buildPortfolioPunchMonthly({
      punchItems: [
        pi({ id: 'a', identifiedOn: '2026-04-15', closedOn: '2026-05-15' }),
      ],
    });
    expect(r.rows.find((x) => x.month === '2026-04')?.identified).toBe(1);
    expect(r.rows.find((x) => x.month === '2026-05')?.closed).toBe(1);
  });

  it('breaks identified down by severity', () => {
    const r = buildPortfolioPunchMonthly({
      punchItems: [
        pi({ id: 'a', severity: 'SAFETY' }),
        pi({ id: 'b', severity: 'MAJOR' }),
        pi({ id: 'c', severity: 'MAJOR' }),
        pi({ id: 'd', severity: 'MINOR' }),
      ],
    });
    expect(r.rows[0]?.identifiedBySeverity.SAFETY).toBe(1);
    expect(r.rows[0]?.identifiedBySeverity.MAJOR).toBe(2);
    expect(r.rows[0]?.identifiedBySeverity.MINOR).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioPunchMonthly({
      punchItems: [
        pi({ id: 'a', jobId: 'j1' }),
        pi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth on both axes', () => {
    const r = buildPortfolioPunchMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      punchItems: [
        pi({ id: 'a', identifiedOn: '2026-04-15', closedOn: '2026-05-15' }),
        pi({ id: 'b', identifiedOn: '2026-03-15', closedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIdentified).toBe(1);
    expect(r.rollup.totalClosed).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioPunchMonthly({
      punchItems: [
        pi({ id: 'a', identifiedOn: '2026-06-15' }),
        pi({ id: 'b', identifiedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioPunchMonthly({ punchItems: [] });
    expect(r.rows).toHaveLength(0);
  });
});
