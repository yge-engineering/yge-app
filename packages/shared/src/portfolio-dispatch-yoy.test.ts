import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildPortfolioDispatchYoy } from './portfolio-dispatch-yoy';

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

describe('buildPortfolioDispatchYoy', () => {
  it('compares prior vs current totals + status mix', () => {
    const r = buildPortfolioDispatchYoy({
      currentYear: 2026,
      dispatches: [
        disp({ id: 'a', scheduledFor: '2025-04-15', status: 'POSTED' }),
        disp({ id: 'b', scheduledFor: '2026-04-15', status: 'POSTED' }),
        disp({ id: 'c', scheduledFor: '2026-04-16', status: 'COMPLETED' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentCompleted).toBe(1);
    expect(r.totalDelta).toBe(1);
  });

  it('counts crew + equipment lines per year', () => {
    const r = buildPortfolioDispatchYoy({
      currentYear: 2026,
      dispatches: [
        disp({
          id: 'a',
          scheduledFor: '2026-04-15',
          crew: [{ name: 'C1' }, { name: 'C2' }],
          equipment: [{ name: 'CAT' }, { name: 'Roller' }],
        }),
      ],
    });
    expect(r.currentTotalCrewLines).toBe(2);
    expect(r.currentTotalEquipmentLines).toBe(2);
  });

  it('counts distinct foremen + jobs', () => {
    const r = buildPortfolioDispatchYoy({
      currentYear: 2026,
      dispatches: [
        disp({ id: 'a', jobId: 'j1', foremanName: 'Pat' }),
        disp({ id: 'b', jobId: 'j2', foremanName: 'Sam' }),
      ],
    });
    expect(r.currentDistinctForemen).toBe(2);
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioDispatchYoy({ currentYear: 2026, dispatches: [] });
    expect(r.currentTotal).toBe(0);
  });
});
