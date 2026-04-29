import { describe, expect, it } from 'vitest';

import type { Employee, EmployeeCertification } from './employee';

import { buildEmployeeCertByMonthExpiring } from './employee-cert-by-month-expiring';

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
    label: 'CDL A',
    expiresOn: '2026-06-15',
    ...over,
  } as EmployeeCertification;
}

describe('buildEmployeeCertByMonthExpiring', () => {
  it('buckets by yyyy-mm of expiresOn', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-06-15' })] }),
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-07-15' })] }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('only counts ACTIVE employees', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [
        emp({ id: 'a', status: 'ACTIVE', certifications: [cert({})] }),
        emp({ id: 'b', status: 'TERMINATED', certifications: [cert({})] }),
      ],
    });
    expect(r.rollup.totalCerts).toBe(1);
  });

  it('skips lifetime certs (no expiresOn)', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [emp({ certifications: [cert({ expiresOn: undefined })] })],
    });
    expect(r.rollup.totalCerts).toBe(0);
  });

  it('skips already-expired certs', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [emp({ certifications: [cert({ expiresOn: '2026-01-01' })] })],
    });
    expect(r.rollup.totalCerts).toBe(0);
  });

  it('breaks down by cert kind', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [
        emp({ id: 'a', certifications: [cert({ kind: 'CDL_A', expiresOn: '2026-06-15' })] }),
        emp({ id: 'b', certifications: [cert({ kind: 'OSHA_30', expiresOn: '2026-06-15' })] }),
      ],
    });
    expect(r.rows[0]?.byKind.CDL_A).toBe(1);
    expect(r.rows[0]?.byKind.OSHA_30).toBe(1);
  });

  it('counts distinct employees per month', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [
        emp({
          id: 'a',
          certifications: [
            cert({ kind: 'CDL_A', expiresOn: '2026-06-15' }),
            cert({ kind: 'OSHA_30', expiresOn: '2026-06-15' }),
          ],
        }),
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-06-15' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      fromMonth: '2026-06',
      toMonth: '2026-06',
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-06-15' })] }),
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-07-15' })] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildEmployeeCertByMonthExpiring({
      asOf: '2026-04-28',
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-08-15' })] }),
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-06-15' })] }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildEmployeeCertByMonthExpiring({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
