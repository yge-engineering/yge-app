import { describe, it, expect } from 'vitest';

import {
  computeMasterProfileCompleteness,
  type MasterProfileCompletenessReport,
  type MasterProfileSectionScore,
} from './master-profile-completeness';
import type { MasterProfile } from './master-profile';

// Minimal valid profile — schema-required fields only. Used as the
// "empty after first edit" baseline so each section starts mostly
// empty and we can add fields incrementally to drive section scores.
function makeBareProfile(): MasterProfile {
  return {
    id: 'master',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Test Co',
    shortName: 'Test',
    cslbLicense: 'L-1',
    cslbClassifications: [],
    dirNumber: 'D-1',
    naicsCodes: [],
    pscCodes: [],
    address: {
      street: '1 Test St',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
    },
    primaryPhone: '555-1212',
    primaryEmail: 'test@example.com',
    officers: [],
    insurance: [],
    isDbe: false,
    isSbe: false,
    isDvbe: false,
    isWbe: false,
  };
}

function section(
  report: MasterProfileCompletenessReport,
  key: MasterProfileSectionScore['key'],
): MasterProfileSectionScore {
  const s = report.sections.find((x) => x.key === key);
  if (!s) throw new Error(`section ${key} missing from report`);
  return s;
}

describe('computeMasterProfileCompleteness', () => {
  it('returns all eight sections in canonical order', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    expect(r.sections.map((s) => s.key)).toEqual([
      'identity',
      'address',
      'contact',
      'officers',
      'bonding',
      'insurance',
      'banking',
      'certifications',
    ]);
  });

  it('reports identity at partial credit for the bare profile', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    const id = section(r, 'identity');
    // legalName + shortName + cslbLicense + dirNumber = 4/8
    expect(id.filledCount).toBe(4);
    expect(id.requiredCount).toBe(8);
    expect(id.percent).toBe(50);
  });

  it('reports address at partial credit (no county, no mailing) for the bare profile', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    const a = section(r, 'address');
    // street + city + state + zip = 4/6
    expect(a.filledCount).toBe(4);
    expect(a.percent).toBe(67);
  });

  it('reports contact at partial credit (phone + email, no fax/web) for bare profile', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    const c = section(r, 'contact');
    expect(c.filledCount).toBe(2);
    expect(c.percent).toBe(50);
  });

  it('reports officers at 0% with no officers', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    expect(section(r, 'officers').percent).toBe(0);
  });

  it('credits officers section for first + second officer + contact', () => {
    const p = makeBareProfile();
    p.officers = [
      {
        id: 'o1', name: 'Brook', title: 'President', roleKey: 'president',
        phone: '555-1', email: 'b@example.com',
      },
      {
        id: 'o2', name: 'Ryan', title: 'VP', roleKey: 'vp',
        phone: '555-2', email: 'r@example.com',
      },
    ];
    const r = computeMasterProfileCompleteness(p);
    // 2 officers + at-least-one-has-contact = 3/4 (no ownership%)
    expect(section(r, 'officers').filledCount).toBe(3);
    expect(section(r, 'officers').percent).toBe(75);
  });

  it('hits 100% on officers when ownership percentage is set', () => {
    const p = makeBareProfile();
    p.officers = [
      {
        id: 'o1', name: 'Brook', title: 'President', roleKey: 'president',
        phone: '555-1', email: 'b@example.com', ownershipPercent: 50,
      },
      {
        id: 'o2', name: 'Ryan', title: 'VP', roleKey: 'vp',
        phone: '555-2', email: 'r@example.com', ownershipPercent: 50,
      },
    ];
    expect(section(computeMasterProfileCompleteness(p), 'officers').percent).toBe(100);
  });

  it('reports bonding at 0% when bonding is undefined', () => {
    expect(
      section(computeMasterProfileCompleteness(makeBareProfile()), 'bonding').percent,
    ).toBe(0);
  });

  it('credits bonding section for surety + limits + agent', () => {
    const p = makeBareProfile();
    p.bonding = {
      suretyName: 'Travelers',
      singleJobLimitCents: 5_000_000_00,
      aggregateLimitCents: 25_000_000_00,
      agentName: 'Jane Surety',
      agentPhone: '555-7000',
    };
    const r = computeMasterProfileCompleteness(p);
    // surety + singleJob + aggregate + agentName + agentContact = 5/5
    expect(section(r, 'bonding').percent).toBe(100);
  });

  it('reports insurance at 0% when no policies', () => {
    expect(
      section(computeMasterProfileCompleteness(makeBareProfile()), 'insurance').percent,
    ).toBe(0);
  });

  it('credits insurance for GL + Auto + WC + expiries (no umbrella)', () => {
    const p = makeBareProfile();
    const base = {
      effectiveDate: '2026-01-01',
      expiresOn: '2027-01-01',
      perOccurrenceCents: 1_000_000_00,
      aggregateCents: 2_000_000_00,
      acordCertOnFile: true,
    };
    p.insurance = [
      { id: 'p1', kind: 'GENERAL_LIABILITY', carrierName: 'A', policyNumber: 'GL-1', ...base },
      { id: 'p2', kind: 'AUTOMOBILE_LIABILITY', carrierName: 'A', policyNumber: 'AL-1', ...base },
      { id: 'p3', kind: 'WORKERS_COMP', carrierName: 'B', policyNumber: 'WC-1', ...base },
    ];
    const r = computeMasterProfileCompleteness(p);
    // GL + Auto + WC + (all-expiries-set) = 4/5
    expect(section(r, 'insurance').filledCount).toBe(4);
    expect(section(r, 'insurance').percent).toBe(80);
  });

  it('overallPercent reflects sum of filled / sum of required across sections', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    // Bare profile: identity 4 + address 4 + contact 2 + officers 0 +
    // bonding 0 + insurance 0 + banking 0 + certs 0 = 10 filled.
    // Totals: 8+6+4+4+5+5+3+3 = 38.
    expect(r.overallPercent).toBe(Math.round((10 / 38) * 100));
  });

  it('counts empty + complete sections', () => {
    const r = computeMasterProfileCompleteness(makeBareProfile());
    expect(r.emptySectionCount).toBeGreaterThanOrEqual(4);
    expect(r.completeSectionCount).toBe(0);
  });

  it('certifications section credits NAICS + PSC + any diversity flag', () => {
    const p = makeBareProfile();
    p.naicsCodes = ['115310'];
    p.pscCodes = ['F003'];
    p.isSbe = true;
    expect(
      section(computeMasterProfileCompleteness(p), 'certifications').percent,
    ).toBe(100);
  });
});
