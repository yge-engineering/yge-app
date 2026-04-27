import { describe, expect, it } from 'vitest';

import type { DailyReport, DailyReportCrewRow } from './daily-report';

import { buildEmployeeCooccurrence } from './employee-cooccurrence';

function row(over: Partial<DailyReportCrewRow>): DailyReportCrewRow {
  return {
    employeeId: 'emp-1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as DailyReportCrewRow;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-01',
    jobId: 'job-1',
    foremanId: 'emp-foreman',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildEmployeeCooccurrence', () => {
  it('skips draft DRs', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          submitted: false,
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    expect(r.pairs).toHaveLength(0);
  });

  it('counts distinct days a pair appeared on the same crew', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          id: 'dr-1',
          date: '2026-04-01',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]?.daysTogether).toBe(2);
  });

  it('captures distinct jobs together + last together date', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          id: 'dr-1',
          date: '2026-04-01',
          jobId: 'job-A',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-15',
          jobId: 'job-B',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    expect(r.pairs[0]?.jobsTogether).toBe(2);
    expect(r.pairs[0]?.lastTogetherDate).toBe('2026-04-15');
  });

  it('builds all pair combinations from a multi-employee crew', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          crewOnSite: [
            row({ employeeId: 'a' }),
            row({ employeeId: 'b' }),
            row({ employeeId: 'c' }),
          ],
        }),
      ],
    });
    // 3 employees → 3 pairs (a-b, a-c, b-c)
    expect(r.pairs).toHaveLength(3);
  });

  it('flags tight pairs (>=10 days together)', () => {
    const reports: DailyReport[] = [];
    for (let d = 1; d <= 12; d += 1) {
      const day = String(d).padStart(2, '0');
      reports.push(dr({
        id: `dr-${d}`,
        date: `2026-04-${day}`,
        crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
      }));
    }
    const r = buildEmployeeCooccurrence({ dailyReports: reports });
    expect(r.rollup.tightPairCount).toBe(1);
  });

  it('respects window bounds', () => {
    const r = buildEmployeeCooccurrence({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          id: 'dr-old',
          date: '2026-04-01',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    expect(r.pairs).toHaveLength(0);
  });

  it('respects minDaysTogether filter', () => {
    const r = buildEmployeeCooccurrence({
      minDaysTogether: 2,
      dailyReports: [
        dr({
          id: 'dr-1',
          date: '2026-04-01',
          crewOnSite: [
            row({ employeeId: 'a' }),
            row({ employeeId: 'b' }),
            row({ employeeId: 'c' }),
          ],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    // Only a-b appears 2 days; a-c and b-c only 1 day each.
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]?.employeeAId).toBe('a');
    expect(r.pairs[0]?.employeeBId).toBe('b');
  });

  it('reports per-employee distinctPartners + top partner', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          id: 'dr-1',
          date: '2026-04-01',
          crewOnSite: [
            row({ employeeId: 'a' }),
            row({ employeeId: 'b' }),
            row({ employeeId: 'c' }),
          ],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
      ],
    });
    const a = r.perEmployee.find((x) => x.employeeId === 'a');
    expect(a?.distinctPartners).toBe(2);
    expect(a?.topPartnerId).toBe('b');
    expect(a?.topPartnerDays).toBe(2);
  });

  it('sorts pairs by daysTogether desc', () => {
    const r = buildEmployeeCooccurrence({
      dailyReports: [
        dr({
          id: 'dr-1',
          date: '2026-04-01',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [row({ employeeId: 'a' }), row({ employeeId: 'b' })],
        }),
        dr({
          id: 'dr-3',
          date: '2026-04-03',
          crewOnSite: [row({ employeeId: 'c' }), row({ employeeId: 'd' })],
        }),
      ],
    });
    expect(r.pairs[0]?.daysTogether).toBe(2);
    expect(r.pairs[1]?.daysTogether).toBe(1);
  });
});
