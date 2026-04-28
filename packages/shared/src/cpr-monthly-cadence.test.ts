import { describe, expect, it } from 'vitest';

import type { CertifiedPayroll, CprEmployeeRow } from './certified-payroll';

import { buildCprMonthlyCadence } from './cpr-monthly-cadence';

function row(over: Partial<CprEmployeeRow>): CprEmployeeRow {
  return {
    employeeId: 'e1',
    name: 'Alice Anderson',
    classification: 'LABORER_GROUP_1',
    dailyHours: [8, 8, 8, 8, 8, 0, 0],
    straightHours: 40,
    overtimeHours: 0,
    hourlyRateCents: 5000,
    fringeRateCents: 1500,
    grossPayCents: 200_000,
    deductionsCents: 0,
    netPayCents: 200_000,
    ...over,
  } as CprEmployeeRow;
}

function cpr(over: Partial<CertifiedPayroll>): CertifiedPayroll {
  return {
    id: 'cpr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    payrollNumber: 1,
    isFinalPayroll: false,
    weekStarting: '2026-04-06',
    weekEnding: '2026-04-12',
    status: 'SUBMITTED',
    rows: [],
    complianceStatementSigned: true,
    ...over,
  } as CertifiedPayroll;
}

describe('buildCprMonthlyCadence', () => {
  it('buckets filings by yyyy-mm of weekStarting', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({ id: 'a', weekStarting: '2026-03-02' }),
        cpr({ id: 'b', weekStarting: '2026-03-09' }),
        cpr({ id: 'c', weekStarting: '2026-04-06' }),
      ],
    });
    expect(r.rows.find((x) => x.month === '2026-03')?.totalFilings).toBe(2);
    expect(r.rows.find((x) => x.month === '2026-04')?.totalFilings).toBe(1);
  });

  it('counts filings by status', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({ id: 'd', status: 'DRAFT' }),
        cpr({ id: 's', status: 'SUBMITTED' }),
        cpr({ id: 'a', status: 'ACCEPTED' }),
        cpr({ id: 'm', status: 'AMENDED' }),
        cpr({ id: 'n', status: 'NON_PERFORMANCE' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.draftCount).toBe(1);
    expect(row?.submittedCount).toBe(1);
    expect(row?.acceptedCount).toBe(1);
    expect(row?.amendedCount).toBe(1);
    expect(row?.nonPerformanceCount).toBe(1);
  });

  it('sums straight + OT hours + gross pay across rows', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({
          rows: [
            row({ employeeId: 'e1', straightHours: 40, overtimeHours: 5, grossPayCents: 100_000 }),
            row({ employeeId: 'e2', straightHours: 32, overtimeHours: 0, grossPayCents: 80_000 }),
          ],
        }),
      ],
    });
    const r0 = r.rows[0];
    expect(r0?.totalStraightHours).toBe(72);
    expect(r0?.totalOvertimeHours).toBe(5);
    expect(r0?.totalGrossPayCents).toBe(180_000);
  });

  it('counts distinct jobs', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({ id: 'a', jobId: 'j1' }),
        cpr({ id: 'b', jobId: 'j2' }),
        cpr({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildCprMonthlyCadence({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      certifiedPayrolls: [
        cpr({ id: 'mar', weekStarting: '2026-03-02' }),
        cpr({ id: 'apr', weekStarting: '2026-04-06' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month filings change', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({ id: 'mar1', weekStarting: '2026-03-02' }),
        cpr({ id: 'apr1', weekStarting: '2026-04-06' }),
        cpr({ id: 'apr2', weekStarting: '2026-04-13' }),
        cpr({ id: 'apr3', weekStarting: '2026-04-20' }),
      ],
    });
    expect(r.rollup.monthOverMonthFilingsChange).toBe(2); // 3 vs 1
  });

  it('rolls up portfolio totals', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({
          id: 'a',
          rows: [row({ straightHours: 40, overtimeHours: 5, grossPayCents: 50_000 })],
        }),
        cpr({
          id: 'b',
          weekStarting: '2026-04-13',
          rows: [row({ straightHours: 30, overtimeHours: 2, grossPayCents: 25_000 })],
        }),
      ],
    });
    expect(r.rollup.totalFilings).toBe(2);
    expect(r.rollup.totalStraightHours).toBe(70);
    expect(r.rollup.totalOvertimeHours).toBe(7);
    expect(r.rollup.totalGrossPayCents).toBe(75_000);
  });

  it('sorts rows by month asc', () => {
    const r = buildCprMonthlyCadence({
      certifiedPayrolls: [
        cpr({ id: 'late', weekStarting: '2026-04-06' }),
        cpr({ id: 'early', weekStarting: '2026-02-02' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildCprMonthlyCadence({ certifiedPayrolls: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.monthOverMonthFilingsChange).toBe(0);
  });
});
