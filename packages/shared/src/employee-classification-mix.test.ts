import { describe, expect, it } from 'vitest';

import type { CertifiedPayroll, CprEmployeeRow } from './certified-payroll';
import type { Employee } from './employee';

import { buildEmployeeClassificationMix } from './employee-classification-mix';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Alice',
    lastName: 'Anderson',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function cprRow(over: Partial<CprEmployeeRow>): CprEmployeeRow {
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

describe('buildEmployeeClassificationMix', () => {
  it('skips DRAFT CPRs', () => {
    const r = buildEmployeeClassificationMix({
      employees: [emp({ id: 'e1' })],
      certifiedPayrolls: [
        cpr({
          status: 'DRAFT',
          rows: [cprRow({ employeeId: 'e1', straightHours: 40 })],
        }),
      ],
    });
    expect(r.rows[0]?.payrollRowCount).toBe(0);
    expect(r.rows[0]?.noPayrollHistory).toBe(true);
  });

  it('respects fromDate window on weekStarting', () => {
    const r = buildEmployeeClassificationMix({
      employees: [emp({ id: 'e1' })],
      certifiedPayrolls: [
        cpr({
          id: 'old',
          weekStarting: '2026-03-02',
          rows: [cprRow({ employeeId: 'e1', straightHours: 40 })],
        }),
        cpr({
          id: 'in',
          weekStarting: '2026-04-06',
          rows: [cprRow({ employeeId: 'e1', straightHours: 35 })],
        }),
      ],
      fromDate: '2026-04-01',
    });
    expect(r.rows[0]?.totalHours).toBe(35);
  });

  it('rolls hours under a single primary classification', () => {
    const r = buildEmployeeClassificationMix({
      employees: [
        emp({ id: 'e1', classification: 'OPERATING_ENGINEER_GROUP_3' }),
      ],
      certifiedPayrolls: [
        cpr({
          rows: [
            cprRow({
              employeeId: 'e1',
              classification: 'OPERATING_ENGINEER_GROUP_3',
              straightHours: 40,
              overtimeHours: 5,
            }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.classifications).toHaveLength(1);
    expect(r.rows[0]?.classifications[0]?.classification).toBe(
      'OPERATING_ENGINEER_GROUP_3',
    );
    expect(r.rows[0]?.classifications[0]?.isPrimary).toBe(true);
    expect(r.rows[0]?.classifications[0]?.totalHours).toBe(45);
    expect(r.rows[0]?.offClassificationHours).toBe(0);
    expect(r.rows[0]?.offClassificationShare).toBe(0);
  });

  it('flags off-classification work and computes share', () => {
    const r = buildEmployeeClassificationMix({
      employees: [
        emp({ id: 'e1', classification: 'OPERATING_ENGINEER_GROUP_3' }),
      ],
      certifiedPayrolls: [
        cpr({
          rows: [
            cprRow({
              employeeId: 'e1',
              classification: 'OPERATING_ENGINEER_GROUP_3',
              straightHours: 30,
            }),
            cprRow({
              employeeId: 'e1',
              classification: 'OPERATING_ENGINEER_GROUP_5',
              straightHours: 10,
            }),
          ],
        }),
      ],
    });
    // Total 40 hours, 10 off-class. Share = 10/40 = 0.25.
    expect(r.rows[0]?.totalHours).toBe(40);
    expect(r.rows[0]?.offClassificationHours).toBe(10);
    expect(r.rows[0]?.offClassificationShare).toBe(0.25);
    expect(r.rollup.employeesWithOffClassificationWork).toBe(1);
    expect(r.rollup.totalOffClassificationHours).toBe(10);
  });

  it('excludes inactive employees by default', () => {
    const r = buildEmployeeClassificationMix({
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      certifiedPayrolls: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.employeeId).toBe('e1');
  });

  it('includes inactive when includeInactive is true', () => {
    const r = buildEmployeeClassificationMix({
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      certifiedPayrolls: [],
      includeInactive: true,
    });
    expect(r.rows).toHaveLength(2);
  });

  it('marks noPayrollHistory for employees never on a CPR', () => {
    const r = buildEmployeeClassificationMix({
      employees: [emp({ id: 'e1' })],
      certifiedPayrolls: [],
    });
    expect(r.rows[0]?.noPayrollHistory).toBe(true);
    expect(r.rollup.employeesWithoutPayroll).toBe(1);
    expect(r.rollup.employeesWithPayroll).toBe(0);
  });

  it('counts distinct jobs per classification', () => {
    const r = buildEmployeeClassificationMix({
      employees: [emp({ id: 'e1', classification: 'LABORER_GROUP_1' })],
      certifiedPayrolls: [
        cpr({
          id: 'c1',
          jobId: 'j1',
          rows: [cprRow({ employeeId: 'e1', straightHours: 40 })],
        }),
        cpr({
          id: 'c2',
          jobId: 'j2',
          rows: [cprRow({ employeeId: 'e1', straightHours: 40 })],
        }),
        cpr({
          id: 'c3',
          jobId: 'j1',
          rows: [cprRow({ employeeId: 'e1', straightHours: 35 })],
        }),
      ],
    });
    expect(r.rows[0]?.classifications[0]?.jobCount).toBe(2);
    expect(r.rows[0]?.classifications[0]?.totalHours).toBe(115);
  });

  it('sorts off-classification first, then on-class history, then no-history', () => {
    const r = buildEmployeeClassificationMix({
      employees: [
        emp({
          id: 'e1',
          firstName: 'Alice',
          classification: 'OPERATING_ENGINEER_GROUP_3',
        }),
        emp({
          id: 'e2',
          firstName: 'Bob',
          classification: 'LABORER_GROUP_1',
        }),
        emp({ id: 'e3', firstName: 'Carol', classification: 'CARPENTER' }),
      ],
      certifiedPayrolls: [
        cpr({
          rows: [
            cprRow({
              employeeId: 'e1',
              classification: 'OPERATING_ENGINEER_GROUP_3',
              straightHours: 35,
            }),
            cprRow({
              employeeId: 'e2',
              classification: 'OPERATING_ENGINEER_GROUP_5',
              straightHours: 20,
            }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('e2');
    expect(r.rows[1]?.employeeId).toBe('e1');
    expect(r.rows[2]?.employeeId).toBe('e3');
  });
});
