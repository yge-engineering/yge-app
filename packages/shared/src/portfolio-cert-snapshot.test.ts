import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildPortfolioCertSnapshot } from './portfolio-cert-snapshot';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Pat',
    lastName: 'Smith',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

describe('buildPortfolioCertSnapshot', () => {
  it('classifies certs as current / expiring soon / expired', () => {
    const r = buildPortfolioCertSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      soonDays: 60,
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2027-04-15' }, // current
            { label: 'CDL A', kind: 'CDL_A', expiresOn: '2026-05-15' }, // soon
            { label: 'CDL B', kind: 'CDL_B', expiresOn: '2026-03-15' }, // expired
          ],
        }),
      ],
    });
    expect(r.totalCerts).toBe(3);
    expect(r.currentCerts).toBe(1);
    expect(r.expiringSoonCerts).toBe(1);
    expect(r.expiredCerts).toBe(1);
  });

  it('breaks down by kind + counts active employees with any cert', () => {
    const r = buildPortfolioCertSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2027-04-15' },
            { label: 'CDL A', kind: 'CDL_A', expiresOn: '2027-04-15' },
          ],
        }),
        emp({ id: 'b', certifications: [] }),
      ],
    });
    expect(r.byKind.OSHA_30).toBe(1);
    expect(r.byKind.CDL_A).toBe(1);
    expect(r.activeEmployeesWithAnyCert).toBe(1);
  });

  it('skips inactive employees', () => {
    const r = buildPortfolioCertSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      employees: [
        emp({
          id: 'a',
          status: 'TERMINATED',
          certifications: [{ label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2027-04-15' }],
        }),
      ],
    });
    expect(r.totalCerts).toBe(0);
  });

  it('treats certs with no expiresOn as current', () => {
    const r = buildPortfolioCertSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      employees: [
        emp({ id: 'a', certifications: [{ label: 'CDL A', kind: 'CDL_A' }] }),
      ],
    });
    expect(r.currentCerts).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCertSnapshot({ employees: [] });
    expect(r.totalCerts).toBe(0);
  });
});
