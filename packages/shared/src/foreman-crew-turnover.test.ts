import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildForemanCrewTurnover } from './foreman-crew-turnover';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

const c = (id: string) => ({ employeeId: id, startTime: '07:00', endTime: '15:00' });

describe('buildForemanCrewTurnover', () => {
  it('counts distinct crew + once-appearance split', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        // Stable crew (e1, e2) on 3 DRs + one transient (e3) on 1 DR
        dr({ id: 'a', date: '2026-04-13', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-14', crewOnSite: [c('e1'), c('e2'), c('e3')] }),
        dr({ id: 'c', date: '2026-04-15', crewOnSite: [c('e1'), c('e2')] }),
      ],
    });
    const row = r.rows[0];
    expect(row?.distinctCrewMembers).toBe(3);
    expect(row?.oneAppearanceCount).toBe(1);
    expect(row?.transientShare).toBeCloseTo(1 / 3, 4);
  });

  it('counts long-haul crew (>= threshold appearances)', () => {
    const r = buildForemanCrewTurnover({
      longHaulThreshold: 3,
      reports: [
        dr({ id: 'a', date: '2026-04-13', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-14', crewOnSite: [c('e1'), c('e3')] }),
        dr({ id: 'c', date: '2026-04-15', crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows[0]?.longHaulCount).toBe(1); // only e1 hits 3 appearances
  });

  it('captures firstDr and lastDr dates', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        dr({ id: 'late', date: '2026-04-25', crewOnSite: [c('e1')] }),
        dr({ id: 'early', date: '2026-04-05', crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows[0]?.firstDr).toBe('2026-04-05');
    expect(r.rows[0]?.lastDr).toBe('2026-04-25');
  });

  it('separates by foremanId', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        dr({ id: 'a', foremanId: 'fm1', crewOnSite: [c('e1')] }),
        dr({ id: 'b', foremanId: 'fm2', crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('skips draft reports', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        dr({ id: 'd', submitted: false, crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects from/to date window', () => {
    const r = buildForemanCrewTurnover({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      reports: [
        dr({ id: 'old', date: '2026-03-15', crewOnSite: [c('e1')] }),
        dr({ id: 'in', date: '2026-04-15', crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(1);
  });

  it('counts crewDayCount (total crew rows)', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        dr({ id: 'a', date: '2026-04-13', crewOnSite: [c('e1'), c('e2'), c('e3')] }),
        dr({ id: 'b', date: '2026-04-14', crewOnSite: [c('e1'), c('e2')] }),
      ],
    });
    expect(r.rows[0]?.crewDayCount).toBe(5);
  });

  it('sorts highest transient share first', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        // fm1 stable: 1 employee × 5 DRs
        dr({ id: 's1', foremanId: 'fm1', date: '2026-04-13', crewOnSite: [c('e1')] }),
        dr({ id: 's2', foremanId: 'fm1', date: '2026-04-14', crewOnSite: [c('e1')] }),
        dr({ id: 's3', foremanId: 'fm1', date: '2026-04-15', crewOnSite: [c('e1')] }),
        // fm2 transient: 3 different employees
        dr({ id: 't1', foremanId: 'fm2', date: '2026-04-13', crewOnSite: [c('e2')] }),
        dr({ id: 't2', foremanId: 'fm2', date: '2026-04-14', crewOnSite: [c('e3')] }),
        dr({ id: 't3', foremanId: 'fm2', date: '2026-04-15', crewOnSite: [c('e4')] }),
      ],
    });
    expect(r.rows[0]?.foremanId).toBe('fm2');
  });

  it('rolls up blended transient share', () => {
    const r = buildForemanCrewTurnover({
      reports: [
        dr({ id: 'a', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-16', crewOnSite: [c('e1'), c('e3')] }),
      ],
    });
    // 3 distinct crew, 2 appeared only once (e2, e3) → 2/3
    expect(r.rollup.blendedTransientShare).toBeCloseTo(2 / 3, 4);
  });

  it('handles empty input', () => {
    const r = buildForemanCrewTurnover({ reports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.foremenConsidered).toBe(0);
  });
});
