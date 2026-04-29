import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildPunchListByJobMonthly } from './punch-list-by-job-monthly';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'Test',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildPunchListByJobMonthly', () => {
  it('groups identified items by (job, month)', () => {
    const r = buildPunchListByJobMonthly({
      punchItems: [
        pi({ id: 'a', jobId: 'j1', identifiedOn: '2026-04-15' }),
        pi({ id: 'b', jobId: 'j1', identifiedOn: '2026-05-01' }),
        pi({ id: 'c', jobId: 'j2', identifiedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts closed items in the closedOn month', () => {
    const r = buildPunchListByJobMonthly({
      punchItems: [
        pi({
          id: 'a',
          identifiedOn: '2026-04-15',
          closedOn: '2026-05-15',
        }),
      ],
    });
    expect(r.rows).toHaveLength(2); // April for identified, May for closed
    expect(r.rows.find((x) => x.month === '2026-04')?.identified).toBe(1);
    expect(r.rows.find((x) => x.month === '2026-05')?.closed).toBe(1);
  });

  it('breaks identified count down by severity', () => {
    const r = buildPunchListByJobMonthly({
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

  it('respects fromMonth / toMonth window for both axes', () => {
    const r = buildPunchListByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      punchItems: [
        pi({ id: 'a', identifiedOn: '2026-04-15', closedOn: '2026-05-01' }),
        pi({ id: 'b', identifiedOn: '2026-03-15', closedOn: '2026-04-15' }),
      ],
    });
    // Item a contributes identified in April. Item b's identified is March
    // (out), close is April (in).
    expect(r.rollup.totalIdentified).toBe(1);
    expect(r.rollup.totalClosed).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildPunchListByJobMonthly({
      punchItems: [
        pi({ id: 'a', closedOn: '2026-04-20' }),
        pi({ id: 'b', closedOn: undefined }),
        pi({ id: 'c', closedOn: '2026-04-25' }),
      ],
    });
    expect(r.rollup.totalIdentified).toBe(3);
    expect(r.rollup.totalClosed).toBe(2);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildPunchListByJobMonthly({
      punchItems: [
        pi({ id: 'a', jobId: 'Z', identifiedOn: '2026-04-15' }),
        pi({ id: 'b', jobId: 'A', identifiedOn: '2026-05-01' }),
        pi({ id: 'c', jobId: 'A', identifiedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildPunchListByJobMonthly({ punchItems: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalIdentified).toBe(0);
  });
});
