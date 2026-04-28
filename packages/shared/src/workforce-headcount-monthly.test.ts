import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildWorkforceHeadcountMonthly } from './workforce-headcount-monthly';

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

describe('buildWorkforceHeadcountMonthly', () => {
  it('counts distinct employees per month', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', date: '2026-03-15', crewOnSite: [c('e1'), c('e2'), c('e3')] }),
        dr({ id: 'b', date: '2026-03-20', crewOnSite: [c('e1'), c('e4')] }),
        dr({ id: 'c', date: '2026-04-01', crewOnSite: [c('e1'), c('e2')] }),
      ],
    });
    const mar = r.rows.find((x) => x.month === '2026-03');
    expect(mar?.distinctActive).toBe(4); // e1, e2, e3, e4
    const apr = r.rows.find((x) => x.month === '2026-04');
    expect(apr?.distinctActive).toBe(2); // e1, e2
  });

  it('counts total person-days', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', crewOnSite: [c('e1'), c('e2'), c('e3')] }),
        dr({ id: 'b', date: '2026-04-16', crewOnSite: [c('e1'), c('e2')] }),
      ],
    });
    expect(r.rows[0]?.totalPersonDays).toBe(5);
  });

  it('counts distinct jobs', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', jobId: 'j1', crewOnSite: [c('e1')] }),
        dr({ id: 'b', jobId: 'j2', crewOnSite: [c('e2')] }),
        dr({ id: 'c', jobId: 'j1', date: '2026-04-16', crewOnSite: [c('e3')] }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('skips draft DRs', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'd', submitted: false, crewOnSite: [c('e1')] }),
        dr({ id: 's', submitted: true, crewOnSite: [c('e2')] }),
      ],
    });
    expect(r.rows[0]?.distinctActive).toBe(1);
  });

  it('respects fromMonth/toMonth', () => {
    const r = buildWorkforceHeadcountMonthly({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      reports: [
        dr({ id: 'jan', date: '2026-01-15', crewOnSite: [c('e1')] }),
        dr({ id: 'mar', date: '2026-03-15', crewOnSite: [c('e1')] }),
        dr({ id: 'apr', date: '2026-04-15', crewOnSite: [c('e1')] }),
        dr({ id: 'may', date: '2026-05-15', crewOnSite: [c('e1')] }),
      ],
    });
    expect(r.rows.map((x) => x.month)).toEqual(['2026-03', '2026-04']);
  });

  it('captures peak month', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', date: '2026-03-15', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-15', crewOnSite: [c('e1'), c('e2'), c('e3'), c('e4'), c('e5')] }),
      ],
    });
    expect(r.rollup.peakMonth).toBe('2026-04');
    expect(r.rollup.peakActive).toBe(5);
  });

  it('computes month-over-month change', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', date: '2026-03-15', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-15', crewOnSite: [c('e1'), c('e2'), c('e3'), c('e4')] }),
      ],
    });
    expect(r.rollup.monthOverMonthChange).toBe(2);
  });

  it('rolls up totalDistinctEmployees across window', () => {
    const r = buildWorkforceHeadcountMonthly({
      reports: [
        dr({ id: 'a', date: '2026-03-15', crewOnSite: [c('e1'), c('e2')] }),
        dr({ id: 'b', date: '2026-04-15', crewOnSite: [c('e2'), c('e3')] }),
      ],
    });
    expect(r.rollup.totalDistinctEmployees).toBe(3); // e1, e2, e3
  });

  it('handles empty input', () => {
    const r = buildWorkforceHeadcountMonthly({ reports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakMonth).toBe(null);
    expect(r.rollup.monthOverMonthChange).toBe(0);
  });
});
