import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildPortfolioDispatchMonthly } from './portfolio-dispatch-monthly';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [{ name: 'C1' }, { name: 'C2' }],
    equipment: [{ name: 'CAT' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildPortfolioDispatchMonthly', () => {
  it('breaks down by status', () => {
    const r = buildPortfolioDispatchMonthly({
      dispatches: [
        disp({ id: 'a', status: 'DRAFT' }),
        disp({ id: 'b', status: 'POSTED' }),
        disp({ id: 'c', status: 'POSTED' }),
        disp({ id: 'd', status: 'COMPLETED' }),
        disp({ id: 'e', status: 'CANCELLED' }),
      ],
    });
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.posted).toBe(2);
    expect(r.rows[0]?.completed).toBe(1);
    expect(r.rows[0]?.cancelled).toBe(1);
  });

  it('counts crew lines + equipment lines', () => {
    const r = buildPortfolioDispatchMonthly({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'C1' }, { name: 'C2' }],
          equipment: [{ name: 'CAT' }],
        }),
        disp({
          id: 'b',
          crew: [{ name: 'C1' }],
          equipment: [],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewLines).toBe(3);
    expect(r.rows[0]?.totalEquipmentLines).toBe(1);
  });

  it('counts distinct foremen + jobs', () => {
    const r = buildPortfolioDispatchMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', foremanName: 'Pat' }),
        disp({ id: 'b', jobId: 'j2', foremanName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioDispatchMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioDispatchMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-06-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioDispatchMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
