import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeCertSnapshot } from './employee-cert-snapshot';

function emp(certs: Employee['certifications']): Employee {
  return {
    id: 'e1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Pat',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: certs,
  } as Employee;
}

describe('buildEmployeeCertSnapshot', () => {
  it('counts current/expiring/expired/lifetime', () => {
    const r = buildEmployeeCertSnapshot({
      asOf: '2026-04-30',
      expiringSoonWindowDays: 60,
      employee: emp([
        { kind: 'CDL_A', label: 'CDL Class A', expiresOn: '2027-01-01' }, // current
        { kind: 'OSHA_30', label: 'OSHA 30' }, // lifetime
        { kind: 'FORKLIFT', label: 'Forklift', expiresOn: '2026-05-15' }, // expiring soon
        { kind: 'FIRST_AID_CPR', label: 'First Aid', expiresOn: '2026-01-15' }, // expired
      ]),
    });
    expect(r.totalCerts).toBe(4);
    expect(r.currentCerts).toBe(2);
    expect(r.expiringSoonCerts).toBe(1);
    expect(r.expiredCerts).toBe(1);
    expect(r.lifetimeCerts).toBe(1);
  });

  it('tracks earliest expiring date', () => {
    const r = buildEmployeeCertSnapshot({
      asOf: '2026-04-30',
      employee: emp([
        { kind: 'CDL_A', label: 'CDL', expiresOn: '2027-01-01' },
        { kind: 'FORKLIFT', label: 'Fork', expiresOn: '2026-06-01' },
      ]),
    });
    expect(r.earliestExpiringDate).toBe('2026-06-01');
  });

  it('handles missing employee', () => {
    const r = buildEmployeeCertSnapshot({ employee: undefined });
    expect(r.totalCerts).toBe(0);
  });
});
