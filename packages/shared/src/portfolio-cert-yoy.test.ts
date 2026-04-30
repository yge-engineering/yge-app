import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildPortfolioCertYoy } from './portfolio-cert-yoy';

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

describe('buildPortfolioCertYoy', () => {
  it('compares prior vs current cert expiries', () => {
    const r = buildPortfolioCertYoy({
      currentYear: 2026,
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2025-04-15' },
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' },
            { label: 'CDL A', kind: 'CDL_A', expiresOn: '2026-05-01' },
          ],
        }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
  });

  it('breaks down by kind', () => {
    const r = buildPortfolioCertYoy({
      currentYear: 2026,
      employees: [
        emp({
          id: 'a',
          certifications: [
            { label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' },
            { label: 'CDL A', kind: 'CDL_A', expiresOn: '2026-04-20' },
          ],
        }),
      ],
    });
    expect(r.currentByKind.OSHA_30).toBe(1);
    expect(r.currentByKind.CDL_A).toBe(1);
  });

  it('skips inactive employees + certs without expiresOn', () => {
    const r = buildPortfolioCertYoy({
      currentYear: 2026,
      employees: [
        emp({
          id: 'a',
          status: 'TERMINATED',
          certifications: [{ label: 'OSHA 30', kind: 'OSHA_30', expiresOn: '2026-04-15' }],
        }),
        emp({
          id: 'b',
          certifications: [{ label: 'CDL A', kind: 'CDL_A' }],
        }),
      ],
    });
    expect(r.currentTotal).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCertYoy({ currentYear: 2026, employees: [] });
    expect(r.currentTotal).toBe(0);
  });
});
