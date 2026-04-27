import { describe, expect, it } from 'vitest';
import { buildCertRenewalCalendar } from './cert-renewal-calendar';
import type { Employee, EmployeeCertification } from './employee';
import type { Vendor } from './vendor';

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

function cert(over: Partial<EmployeeCertification>): EmployeeCertification {
  return {
    kind: 'OTHER',
    label: 'Safety',
    expiresOn: '2026-06-01',
    ...over,
  } as EmployeeCertification;
}

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Acme Subs',
    kind: 'SUBCONTRACTOR',
    coiOnFile: true,
    coiExpiresOn: '2026-08-01',
    ...over,
  } as Vendor;
}

describe('buildCertRenewalCalendar', () => {
  it('groups upcoming certs by month', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-01',
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-05-15' })] }),
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-05-20' })] }),
        emp({ id: 'c', certifications: [cert({ expiresOn: '2026-08-01' })] }),
      ],
    });
    const may = r.months.find((m) => m.month === '2026-05')!;
    expect(may.count).toBe(2);
    const aug = r.months.find((m) => m.month === '2026-08')!;
    expect(aug.count).toBe(1);
  });

  it('puts expired rows in their own bucket', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-15',
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-03-15' })] }), // expired
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-05-15' })] }), // future
      ],
    });
    expect(r.expired).toHaveLength(1);
    expect(r.totalUpcoming).toBe(1);
  });

  it('respects monthsAhead window', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-01',
      monthsAhead: 3,
      employees: [
        emp({ id: 'a', certifications: [cert({ expiresOn: '2026-05-15' })] }), // in
        emp({ id: 'b', certifications: [cert({ expiresOn: '2026-08-15' })] }), // out (Aug > July cutoff)
      ],
    });
    expect(r.months).toHaveLength(1);
  });

  it('combines employee certs and subcontractor COIs', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-01',
      employees: [emp({ id: 'a', certifications: [cert({ expiresOn: '2026-05-15' })] })],
      vendors: [vendor({ id: 'v', coiExpiresOn: '2026-06-15' })],
    });
    expect(r.totalUpcoming).toBe(2);
    expect(r.months.length).toBe(2);
  });

  it('months emitted chronologically; rows within month sorted', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-01',
      employees: [
        emp({ id: '1', certifications: [cert({ expiresOn: '2026-07-15' })] }),
        emp({ id: '2', certifications: [cert({ expiresOn: '2026-05-25' })] }),
        emp({ id: '3', certifications: [cert({ expiresOn: '2026-05-10' })] }),
      ],
    });
    const may = r.months.find((m) => m.month === '2026-05')!;
    expect(may.rows[0]?.expiresOn).toBe('2026-05-10');
    expect(may.rows[1]?.expiresOn).toBe('2026-05-25');
    expect(r.months.map((m) => m.month)).toEqual(['2026-05', '2026-07']);
  });

  it('expired rows sorted most-overdue first', () => {
    const r = buildCertRenewalCalendar({
      asOf: '2026-04-15',
      employees: [
        emp({ id: '1', certifications: [cert({ expiresOn: '2026-03-15' })] }), // 31 days expired
        emp({ id: '2', certifications: [cert({ expiresOn: '2025-12-01' })] }), // 135 days
      ],
    });
    expect(r.expired[0]?.expiresOn).toBe('2025-12-01');
  });
});
