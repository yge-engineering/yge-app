import { describe, expect, it } from 'vitest';
import {
  computeWatchlistRollup,
  rowsFromEmployees,
  rowsFromVendors,
  sortWatchlistRows,
} from './cert-watchlist';
import type { Employee, EmployeeCertification } from './employee';
import type { Vendor } from './vendor';

const NOW = new Date('2026-04-25T00:00:00Z');

function emp(over: Partial<Employee>, certs: Partial<EmployeeCertification>[] = []): Employee {
  return {
    id: 'emp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: certs.map((c) => ({
      kind: 'CDL_A',
      label: 'CDL Class A',
      ...c,
    } as EmployeeCertification)),
    ...over,
  } as Employee;
}

function ven(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    legalName: 'Acme Concrete',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    coiOnFile: true,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('rowsFromEmployees', () => {
  it('skips lifetime certs (no expiresOn)', () => {
    const rows = rowsFromEmployees(
      [emp({}, [{ kind: 'OSHA_30', label: 'OSHA 30', expiresOn: undefined }])],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('skips inactive employees', () => {
    const rows = rowsFromEmployees(
      [
        emp({ status: 'TERMINATED' }, [
          { kind: 'CDL_A', label: 'CDL A', expiresOn: '2026-05-15' },
        ]),
      ],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('buckets correctly: expired, 30, 60, 90, beyond', () => {
    const rows = rowsFromEmployees(
      [
        emp({ id: 'emp-11111111' }, [
          { kind: 'CDL_A', label: 'CDL A', expiresOn: '2026-04-01' },  // expired (24d ago)
          { kind: 'OSHA_10', label: 'OSHA 10', expiresOn: '2026-05-15' }, // ~20d
          { kind: 'FIRST_AID_CPR', label: 'First Aid', expiresOn: '2026-06-15' }, // ~51d
          { kind: 'FORKLIFT', label: 'Forklift', expiresOn: '2026-07-15' }, // ~81d
          { kind: 'CRANE_OPERATOR', label: 'Crane', expiresOn: '2026-12-31' }, // beyond
        ]),
      ],
      NOW,
    );
    const buckets = rows.map((r) => r.bucket).sort();
    expect(buckets).toEqual([
      'BEYOND',
      'EXPIRED',
      'WITHIN_30',
      'WITHIN_60',
      'WITHIN_90',
    ].sort());
  });
});

describe('rowsFromVendors', () => {
  it('only includes subcontractor COIs', () => {
    const rows = rowsFromVendors(
      [
        ven({ id: 'vnd-1', kind: 'SUPPLIER', coiExpiresOn: '2026-05-15' }),
        ven({ id: 'vnd-2', coiExpiresOn: '2026-05-15' }),
        ven({ id: 'vnd-3', coiExpiresOn: undefined }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectId).toBe('vnd-2');
  });
});

describe('sortWatchlistRows', () => {
  it('sorts ascending by daysUntilExpiry (expired first)', () => {
    const rows = [
      ...rowsFromEmployees(
        [
          emp({ id: 'emp-1' }, [{ kind: 'CDL_A', label: 'A', expiresOn: '2026-08-01' }]),
          emp({ id: 'emp-2' }, [{ kind: 'CDL_A', label: 'B', expiresOn: '2026-04-01' }]),
        ],
        NOW,
      ),
    ];
    const sorted = sortWatchlistRows(rows);
    expect(sorted[0]?.subjectId).toBe('emp-2'); // expired comes first
  });
});

describe('computeWatchlistRollup', () => {
  it('counts unique subjects in immediateActionSubjects', () => {
    const rows = rowsFromEmployees(
      [
        emp({ id: 'emp-1' }, [
          { kind: 'CDL_A', label: 'CDL', expiresOn: '2026-04-01' }, // expired
          { kind: 'OSHA_10', label: 'O10', expiresOn: '2026-05-01' }, // <30
        ]),
        emp({ id: 'emp-2' }, [
          { kind: 'CDL_A', label: 'CDL', expiresOn: '2026-09-01' }, // ~130d, beyond
        ]),
      ],
      NOW,
    );
    const r = computeWatchlistRollup(rows);
    // emp-1 contributes 2 rows but only counts as 1 subject.
    expect(r.immediateActionSubjects).toBe(1);
    expect(r.expired).toBe(1);
    expect(r.within30).toBe(1);
    expect(r.beyond90).toBe(1);
  });
});
