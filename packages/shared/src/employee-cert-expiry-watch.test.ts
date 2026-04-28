import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeCertExpiryWatch } from './employee-cert-expiry-watch';

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

describe('buildEmployeeCertExpiryWatch', () => {
  it('classifies certs into expiry tiers', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [
        emp({
          id: 'e1',
          certifications: [
            { kind: 'CDL_A', label: 'CDL Class A', expiresOn: '2026-04-01' }, // expired
            { kind: 'OSHA_10', label: 'OSHA 10', expiresOn: '2026-05-15' }, // 15 days = E30
            { kind: 'OSHA_30', label: 'OSHA 30', expiresOn: '2026-06-15' }, // 46 days = E60
            { kind: 'FIRST_AID_CPR', label: 'CPR', expiresOn: '2026-07-15' }, // 76 days = E90
            { kind: 'FORKLIFT', label: 'Forklift', expiresOn: '2026-12-15' }, // 229 days = CURRENT
            { kind: 'OTHER', label: 'Other', expiresOn: undefined }, // LIFETIME
          ],
        }),
      ],
    });
    const row = r.rows[0];
    expect(row?.expiredCount).toBe(1);
    expect(row?.expiring30Count).toBe(1);
    expect(row?.expiring60Count).toBe(1);
    expect(row?.expiring90Count).toBe(1);
    expect(row?.currentCount).toBe(1);
    expect(row?.lifetimeCount).toBe(1);
  });

  it('worstTier is the lowest-ranked tier across certs', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [
        emp({
          id: 'e1',
          certifications: [
            { kind: 'OTHER', label: 'A', expiresOn: undefined }, // LIFETIME
            { kind: 'OTHER', label: 'B', expiresOn: '2026-04-01' }, // EXPIRED
          ],
        }),
      ],
    });
    expect(r.rows[0]?.worstTier).toBe('EXPIRED');
  });

  it('worstTier is LIFETIME when no certifications', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [emp({ certifications: [] })],
    });
    expect(r.rows[0]?.worstTier).toBe('LIFETIME');
  });

  it('excludes inactive employees by default', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('includeInactive surfaces all', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      includeInactive: true,
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sorts worst tier first', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [
        emp({
          id: 'clean',
          firstName: 'Clean',
          certifications: [{ kind: 'OTHER', label: 'Lifetime' }],
        }),
        emp({
          id: 'expired',
          firstName: 'Expired',
          certifications: [{ kind: 'CDL_A', label: 'CDL', expiresOn: '2026-01-01' }],
        }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('expired');
  });

  it('rolls up portfolio totals', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [
        emp({
          id: 'e1',
          certifications: [
            { kind: 'CDL_A', label: 'CDL', expiresOn: '2026-04-01' },
          ],
        }),
        emp({
          id: 'e2',
          certifications: [
            { kind: 'OSHA_10', label: 'OSHA', expiresOn: '2026-05-15' },
          ],
        }),
      ],
    });
    expect(r.rollup.totalExpired).toBe(1);
    expect(r.rollup.totalExpiring30).toBe(1);
    expect(r.rollup.totalCerts).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildEmployeeCertExpiryWatch({
      asOf: '2026-04-30',
      employees: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
