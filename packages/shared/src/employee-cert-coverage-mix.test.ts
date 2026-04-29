import { describe, expect, it } from 'vitest';

import type { Employee, EmployeeCertification } from './employee';

import { buildEmployeeCertCoverageMix } from './employee-cert-coverage-mix';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Test',
    lastName: 'Person',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function cert(over: Partial<EmployeeCertification>): EmployeeCertification {
  return {
    kind: 'CDL_A',
    label: 'CDL Class A',
    expiresOn: '2027-04-01',
    ...over,
  } as EmployeeCertification;
}

describe('buildEmployeeCertCoverageMix', () => {
  it('only counts active employees', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'a', status: 'ACTIVE', certifications: [cert({})] }),
        emp({ id: 'b', status: 'TERMINATED', certifications: [cert({})] }),
      ],
    });
    expect(r.rollup.activeWorkforce).toBe(1);
    expect(r.rows[0]?.holders).toBe(1);
  });

  it('groups by certification kind', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'a', certifications: [cert({ kind: 'CDL_A' })] }),
        emp({ id: 'b', certifications: [cert({ kind: 'OSHA_30' })] }),
        emp({ id: 'c', certifications: [cert({ kind: 'CDL_A' })] }),
      ],
    });
    const cdl = r.rows.find((x) => x.kind === 'CDL_A');
    expect(cdl?.holders).toBe(2);
  });

  it('classifies current vs expiring-soon vs expired', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      soonDays: 60,
      employees: [
        emp({ id: 'far', certifications: [cert({ expiresOn: '2027-04-01' })] }),
        emp({ id: 'soon', certifications: [cert({ expiresOn: '2026-05-15' })] }),
        emp({ id: 'expired', certifications: [cert({ expiresOn: '2026-01-01' })] }),
      ],
    });
    const row = r.rows[0];
    expect(row?.currentHolders).toBe(2); // far + soon
    expect(row?.expiringSoonHolders).toBe(1);
    expect(row?.expiredHolders).toBe(1);
  });

  it('treats lifetime certs (no expiresOn) as current', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      employees: [emp({ certifications: [cert({ kind: 'OSHA_30', expiresOn: undefined })] })],
    });
    const osha = r.rows.find((x) => x.kind === 'OSHA_30');
    expect(osha?.currentHolders).toBe(1);
  });

  it('counts each employee once per kind even with duplicate cert entries', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({
          id: 'a',
          certifications: [
            cert({ kind: 'CDL_A', expiresOn: '2027-04-01' }),
            cert({ kind: 'CDL_A', expiresOn: '2028-04-01' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.holders).toBe(1);
    expect(r.rows[0]?.currentHolders).toBe(1);
  });

  it('sorts by currentHolders desc', () => {
    const r = buildEmployeeCertCoverageMix({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'a', certifications: [cert({ kind: 'OSHA_10' })] }),
        emp({ id: 'b', certifications: [cert({ kind: 'CDL_A' })] }),
        emp({ id: 'c', certifications: [cert({ kind: 'CDL_A' })] }),
        emp({ id: 'd', certifications: [cert({ kind: 'CDL_A' })] }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('CDL_A');
  });

  it('handles empty input', () => {
    const r = buildEmployeeCertCoverageMix({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
