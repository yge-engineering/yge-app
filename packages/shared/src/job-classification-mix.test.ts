import { describe, expect, it } from 'vitest';
import { buildJobClassificationMix } from './job-classification-mix';
import type { CertifiedPayroll, CprEmployeeRow } from './certified-payroll';

function row(over: Partial<CprEmployeeRow>): CprEmployeeRow {
  return {
    employeeId: 'emp-1',
    name: 'Jane Doe',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    dailyHours: [8, 8, 8, 8, 8, 0, 0],
    straightHours: 40,
    overtimeHours: 0,
    hourlyRateCents: 60_00,
    fringeRateCents: 30_00,
    grossPayCents: 2_400_00,
    deductionsCents: 0,
    netPayCents: 0,
    ...over,
  } as CprEmployeeRow;
}

function cpr(jobId: string, rows: CprEmployeeRow[]): CertifiedPayroll {
  return {
    id: `cpr-${jobId}-1`,
    createdAt: '',
    updatedAt: '',
    jobId,
    payrollNumber: 1,
    isFinalPayroll: false,
    weekStarting: '2026-04-13',
    weekEnding: '2026-04-19',
    status: 'SUBMITTED',
    rows,
    complianceStatementSigned: true,
  } as CertifiedPayroll;
}

describe('buildJobClassificationMix', () => {
  it('rolls hours per classification and computes share', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-1',
      certifiedPayrolls: [
        cpr('job-1', [
          row({ classification: 'OPERATING_ENGINEER_GROUP_1', straightHours: 40, overtimeHours: 4 }),
          row({ classification: 'LABORER_GROUP_1', straightHours: 80, overtimeHours: 0 }),
        ]),
      ],
    });
    expect(r.totalHours).toBe(124);
    const op = r.rows.find((x) => x.classification === 'OPERATING_ENGINEER_GROUP_1')!;
    expect(op.totalHours).toBe(44);
    expect(op.shareOfTotal).toBeCloseTo(44 / 124, 4);
  });

  it('only counts CPRs for the requested job', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-A',
      certifiedPayrolls: [
        cpr('job-A', [row({ straightHours: 40 })]),
        cpr('job-B', [row({ straightHours: 99_999 })]),
      ],
    });
    expect(r.cprsConsidered).toBe(1);
    expect(r.totalHours).toBe(40);
  });

  it('skips DRAFT CPRs', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-1',
      certifiedPayrolls: [
        { ...cpr('job-1', [row({ straightHours: 40 })]), status: 'DRAFT' },
        cpr('job-1', [row({ straightHours: 80 })]),
      ],
    });
    expect(r.cprsConsidered).toBe(1);
    expect(r.totalHours).toBe(80);
  });

  it('aggregates same classification across multiple CPRs', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-1',
      certifiedPayrolls: [
        cpr('job-1', [row({ straightHours: 40 })]),
        cpr('job-1', [row({ straightHours: 30 })]),
      ],
    });
    expect(r.rows[0]?.straightHours).toBe(70);
  });

  it('sums grossPay per classification', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-1',
      certifiedPayrolls: [
        cpr('job-1', [
          row({ grossPayCents: 1_000_00 }),
          row({ grossPayCents: 2_000_00 }),
        ]),
      ],
    });
    expect(r.totalGrossPayCents).toBe(3_000_00);
    expect(r.rows[0]?.grossPayCents).toBe(3_000_00);
  });

  it('sorts highest-hours classification first', () => {
    const r = buildJobClassificationMix({
      jobId: 'job-1',
      certifiedPayrolls: [
        cpr('job-1', [
          row({ classification: 'CARPENTER', straightHours: 10 }),
          row({ classification: 'LABORER_GROUP_1', straightHours: 100 }),
          row({ classification: 'OPERATING_ENGINEER_GROUP_1', straightHours: 50 }),
        ]),
      ],
    });
    expect(r.rows.map((x) => x.classification)).toEqual([
      'LABORER_GROUP_1',
      'OPERATING_ENGINEER_GROUP_1',
      'CARPENTER',
    ]);
  });
});
