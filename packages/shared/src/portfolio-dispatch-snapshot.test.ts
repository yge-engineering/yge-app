import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildPortfolioDispatchSnapshot } from './portfolio-dispatch-snapshot';

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'Trench + lay pipe',
    crew: [{ name: 'A' }, { name: 'B' }],
    equipment: [{ name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildPortfolioDispatchSnapshot', () => {
  it('counts dispatches + ytd', () => {
    const r = buildPortfolioDispatchSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.totalDispatches).toBe(2);
    expect(r.ytdDispatches).toBe(1);
  });

  it('sums crew + equipment seats', () => {
    const r = buildPortfolioDispatchSnapshot({
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', crew: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], equipment: [{ name: 'X' }, { name: 'Y' }] }),
        dp({ id: 'b', crew: [{ name: 'D' }], equipment: [] }),
      ],
    });
    expect(r.totalCrewSeats).toBe(4);
    expect(r.totalEquipmentSlots).toBe(2);
  });

  it('breaks down by status', () => {
    const r = buildPortfolioDispatchSnapshot({
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', status: 'DRAFT' }),
        dp({ id: 'b', status: 'POSTED' }),
        dp({ id: 'c', status: 'COMPLETED' }),
      ],
    });
    expect(r.byStatus.DRAFT).toBe(1);
    expect(r.byStatus.POSTED).toBe(1);
    expect(r.byStatus.COMPLETED).toBe(1);
  });

  it('counts distinct jobs + foremen', () => {
    const r = buildPortfolioDispatchSnapshot({
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', jobId: 'j1', foremanName: 'Pat' }),
        dp({ id: 'b', jobId: 'j2', foremanName: 'Sam' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctForemen).toBe(2);
  });

  it('ignores dispatches after asOf', () => {
    const r = buildPortfolioDispatchSnapshot({
      asOf: '2026-04-30',
      dispatches: [dp({ id: 'late', scheduledFor: '2026-05-15' })],
    });
    expect(r.totalDispatches).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioDispatchSnapshot({ dispatches: [] });
    expect(r.totalDispatches).toBe(0);
  });
});
