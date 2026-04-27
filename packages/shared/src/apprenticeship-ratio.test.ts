import { describe, expect, it } from 'vitest';
import { buildApprenticeshipRatioAudit } from './apprenticeship-ratio';
import type { CertifiedPayroll, CprEmployeeRow } from './certified-payroll';
import type { Employee } from './employee';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

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
    grossPayCents: 0,
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

describe('buildApprenticeshipRatioAudit', () => {
  it('compliant when 5 journey + 1 apprentice in same craft', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [
        emp({ id: 'emp-j', role: 'OPERATOR' }),
        emp({ id: 'emp-a', role: 'APPRENTICE' }),
      ],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'emp-j', straightHours: 200, classification: 'OPERATING_ENGINEER_GROUP_1' }),
          row({ employeeId: 'emp-a', straightHours: 40, classification: 'OPERATING_ENGINEER_GROUP_1' }),
        ]),
      ],
    });
    // Journey 200, Apprentice 40 → 0.20 ratio = 1:5 → compliant.
    expect(r.blendedCompliant).toBe(true);
    expect(r.byCraft[0]?.compliant).toBe(true);
    expect(r.byCraft[0]?.shortfallHours).toBe(0);
  });

  it('non-compliant when 5 journey + 0 apprentice', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [emp({ id: 'emp-j', role: 'OPERATOR' })],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'emp-j', straightHours: 100 }),
        ]),
      ],
    });
    expect(r.blendedCompliant).toBe(false);
    // Need 20 apprentice hours to reach 1:5 on 100 journey.
    expect(r.byCraft[0]?.shortfallHours).toBe(20);
  });

  it('OT hours count toward journey hours', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [emp({ id: 'emp-j', role: 'OPERATOR' })],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'emp-j', straightHours: 40, overtimeHours: 10 }),
        ]),
      ],
    });
    expect(r.byCraft[0]?.journeyHours).toBe(50);
  });

  it('split crafts get separate buckets', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [
        emp({ id: 'op', role: 'OPERATOR' }),
        emp({ id: 'lab', role: 'LABORER' }),
      ],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'op', classification: 'OPERATING_ENGINEER_GROUP_1', straightHours: 40 }),
          row({ employeeId: 'lab', classification: 'LABORER_GROUP_1', straightHours: 40 }),
        ]),
      ],
    });
    expect(r.byCraft).toHaveLength(2);
  });

  it('UNRESOLVED employees go in unknown bucket but count as journey', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [],
      certifiedPayrolls: [
        cpr('job-1', [row({ employeeId: 'ghost', straightHours: 40 })]),
      ],
    });
    expect(r.unresolvedEmployeeIds).toEqual(['ghost']);
    expect(r.byCraft[0]?.unknownHours).toBe(40);
    expect(r.byCraft[0]?.journeyHours).toBe(40);
  });

  it('skips DRAFT CPRs', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [emp({ id: 'emp-j', role: 'OPERATOR' })],
      certifiedPayrolls: [
        {
          ...cpr('job-1', [row({ employeeId: 'emp-j', straightHours: 200 })]),
          status: 'DRAFT',
        },
      ],
    });
    expect(r.cprsConsidered).toBe(0);
    expect(r.totalJourneyHours).toBe(0);
  });

  it('only includes CPRs for the requested jobId', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-A',
      employees: [emp({ id: 'emp-j', role: 'OPERATOR' })],
      certifiedPayrolls: [
        cpr('job-A', [row({ employeeId: 'emp-j', straightHours: 100 })]),
        cpr('job-B', [row({ employeeId: 'emp-j', straightHours: 99_999 })]),
      ],
    });
    expect(r.cprsConsidered).toBe(1);
    expect(r.totalJourneyHours).toBe(100);
  });

  it('honors custom ratioThreshold', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      ratioThreshold: 0.5, // requires 1:2
      employees: [
        emp({ id: 'emp-j', role: 'OPERATOR' }),
        emp({ id: 'emp-a', role: 'APPRENTICE' }),
      ],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'emp-j', straightHours: 100 }),
          row({ employeeId: 'emp-a', straightHours: 30 }),
        ]),
      ],
    });
    // 30/100 = 0.30, threshold 0.5 → non-compliant. Shortfall = 50-30 = 20
    expect(r.byCraft[0]?.compliant).toBe(false);
    expect(r.byCraft[0]?.shortfallHours).toBe(20);
  });

  it('sorts byCraft worst (largest shortfall) first', () => {
    const r = buildApprenticeshipRatioAudit({
      jobId: 'job-1',
      employees: [
        emp({ id: 'op', role: 'OPERATOR' }),
        emp({ id: 'lab', role: 'LABORER' }),
        emp({ id: 'app', role: 'APPRENTICE' }),
      ],
      certifiedPayrolls: [
        cpr('job-1', [
          row({ employeeId: 'op', classification: 'OPERATING_ENGINEER_GROUP_1', straightHours: 40 }),
          row({ employeeId: 'app', classification: 'OPERATING_ENGINEER_GROUP_1', straightHours: 8 }),
          row({ employeeId: 'lab', classification: 'LABORER_GROUP_1', straightHours: 100 }),
        ]),
      ],
    });
    // Operating Engineer compliant (8/40 = 1:5). LABORER 0/100 → shortfall 20.
    expect(r.byCraft[0]?.classification).toBe('LABORER_GROUP_1');
  });
});
