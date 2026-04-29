import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildPortfolioCertMonthlyExpiring } from './portfolio-cert-monthly-expiring';

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
    certifications: [
      { label: 'OSHA-30 General Industry', kind: 'OSHA_30', expiresOn: '2026-04-15' },
    ],
    ...over,
  } as Employee;
}

describe('buildPortfolioCertMonthlyExpiring', () => {
  it('breaks down by CertificationKind', () => {
    const r = buildPortfolioCertMonthlyExpiring({
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' },
            { label: 'CDL A', kind: 'CDL_A', expiresOn: '2026-04-20' },
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-25' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.byKind.OSHA_30).toBe(2);
    expect(r.rows[0]?.byKind.CDL_A).toBe(1);
  });

  it('skips inactive employees + certs with no expiresOn', () => {
    const r = buildPortfolioCertMonthlyExpiring({
      employees: [
        emp({ id: 'a', status: 'TERMINATED' }),
        emp({
          id: 'b',
          certifications: [
            { label: 'CDL A', kind: 'CDL_A' },
          ],
        }),
      ],
    });
    expect(r.rollup.noActiveSkipped).toBe(1);
    expect(r.rollup.noExpirySkipped).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCertMonthlyExpiring({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-03-15' },
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' },
          ],
        }),
      ],
    });
    expect(r.rollup.totalCerts).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCertMonthlyExpiring({
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-06-15' },
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCertMonthlyExpiring({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
