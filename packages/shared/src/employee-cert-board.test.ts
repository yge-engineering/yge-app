import { describe, expect, it } from 'vitest';

import type { Employee, EmployeeCertification } from './employee';

import { buildEmployeeCertBoard } from './employee-cert-board';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function cert(over: Partial<EmployeeCertification>): EmployeeCertification {
  return {
    kind: 'OSHA_10',
    label: 'OSHA-10',
    expiresOn: '2027-04-01',
    issuer: 'OSHA',
    ...over,
  } as EmployeeCertification;
}

describe('buildEmployeeCertBoard', () => {
  it('skips non-ACTIVE employees', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ status: 'TERMINATED' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('flags LIFETIME when no expiresOn', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: undefined })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('LIFETIME');
  });

  it('flags EXPIRED when expiresOn passed', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: '2026-03-15' })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('EXPIRED');
    expect(r.rows[0]?.expiredCount).toBe(1);
  });

  it('flags EXPIRING_30 for 0-30 days out', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: '2026-05-15' })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('EXPIRING_30');
  });

  it('flags EXPIRING_60 for 31-60 days', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: '2026-06-15' })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('EXPIRING_60');
  });

  it('flags EXPIRING_90 for 61-90 days', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: '2026-07-20' })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('EXPIRING_90');
  });

  it('flags CURRENT for 90+ days out', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [emp({ certifications: [cert({ expiresOn: '2027-04-01' })] })],
    });
    expect(r.rows[0]?.certs[0]?.flag).toBe('CURRENT');
  });

  it('picks most-urgent cert as worstCert', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [
        emp({
          certifications: [
            cert({ kind: 'OSHA_10', label: 'OSHA-10', expiresOn: '2027-04-01' }),
            cert({ kind: 'CDL_A', label: 'CDL-A', expiresOn: '2026-03-15' }),
            cert({ kind: 'FORKLIFT', label: 'Forklift', expiresOn: '2026-05-15' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.worstCert?.kind).toBe('CDL_A');
  });

  it('rolls up byKind across employees', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [
        emp({
          id: 'e1',
          firstName: 'A',
          lastName: 'X',
          certifications: [cert({ kind: 'OSHA_10', expiresOn: '2026-03-15' })],
        }),
        emp({
          id: 'e2',
          firstName: 'B',
          lastName: 'Y',
          certifications: [cert({ kind: 'OSHA_10', expiresOn: '2027-04-01' })],
        }),
      ],
    });
    const osha = r.rollup.byKind.find((k) => k.kind === 'OSHA_10');
    expect(osha?.totalEmployees).toBe(2);
    expect(osha?.expired).toBe(1);
  });

  it('sorts employees with most expired first', () => {
    const r = buildEmployeeCertBoard({
      asOf: '2026-04-27',
      employees: [
        emp({
          id: 'e-clean',
          firstName: 'Clean',
          lastName: 'Smith',
          certifications: [cert({ expiresOn: '2027-04-01' })],
        }),
        emp({
          id: 'e-expired',
          firstName: 'Expired',
          lastName: 'Jones',
          certifications: [cert({ expiresOn: '2026-03-15' })],
        }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('e-expired');
  });
});
