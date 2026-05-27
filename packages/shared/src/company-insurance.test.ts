import { describe, it, expect } from 'vitest';

import {
  InsuranceProfileSchema,
  combinedEachOccurrenceCents,
  policyExpiryState,
  worstPolicySeverity,
  type InsuranceProfile,
} from './company-insurance';

const baseProfile: InsuranceProfile = {
  generalLiability: {
    carrier: 'Travelers',
    policyNumber: 'GL-001-2026',
    eachOccurrenceLimitCents: 2_000_000_00,
    aggregateLimitCents: 4_000_000_00,
    expiryDate: '2027-03-01',
  },
  commercialAuto: {
    carrier: 'Progressive Commercial',
    policyNumber: 'CA-002-2026',
    eachOccurrenceLimitCents: 1_000_000_00,
    expiryDate: '2027-03-01',
  },
  workersComp: {
    carrier: 'State Fund',
    policyNumber: 'WC-003-2026',
    expiryDate: '2027-01-01',
  },
  umbrella: {
    carrier: 'Lloyd\'s',
    policyNumber: 'UM-004-2026',
    eachOccurrenceLimitCents: 5_000_000_00,
    aggregateLimitCents: 5_000_000_00,
    expiryDate: '2027-03-01',
  },
};

describe('InsuranceProfileSchema', () => {
  it('parses a complete profile', () => {
    expect(() => InsuranceProfileSchema.parse(baseProfile)).not.toThrow();
  });

  it('parses without umbrella (optional)', () => {
    const { umbrella, ...rest } = baseProfile;
    void umbrella;
    expect(() => InsuranceProfileSchema.parse(rest)).not.toThrow();
  });

  it('rejects malformed expiry dates', () => {
    expect(() =>
      InsuranceProfileSchema.parse({
        ...baseProfile,
        generalLiability: {
          ...baseProfile.generalLiability,
          expiryDate: '03/01/2027',
        },
      }),
    ).toThrow();
  });
});

describe('policyExpiryState', () => {
  it('reports ok when > 45 days out', () => {
    const state = policyExpiryState(
      baseProfile.generalLiability,
      new Date('2026-12-01T00:00:00Z'),
    );
    expect(state.severity).toBe('ok');
    expect(state.daysUntilExpiry).toBeGreaterThan(45);
  });

  it('reports soon at 30 days', () => {
    const state = policyExpiryState(
      baseProfile.generalLiability,
      new Date('2027-01-30T00:00:00Z'),
    );
    expect(state.severity).toBe('soon');
  });

  it('reports critical at 7 days', () => {
    const state = policyExpiryState(
      baseProfile.generalLiability,
      new Date('2027-02-22T00:00:00Z'),
    );
    expect(state.severity).toBe('critical');
  });

  it('reports expired after expiry date', () => {
    const state = policyExpiryState(
      baseProfile.generalLiability,
      new Date('2027-04-01T00:00:00Z'),
    );
    expect(state.severity).toBe('expired');
    expect(state.daysUntilExpiry).toBeLessThan(0);
  });
});

describe('worstPolicySeverity', () => {
  it('returns ok when all policies have plenty of runway', () => {
    expect(
      worstPolicySeverity(baseProfile, new Date('2026-08-01T00:00:00Z')),
    ).toBe('ok');
  });

  it('escalates to expired when one policy is expired', () => {
    const profile = {
      ...baseProfile,
      workersComp: {
        ...baseProfile.workersComp,
        expiryDate: '2025-12-01',
      },
    };
    expect(
      worstPolicySeverity(profile, new Date('2026-08-01T00:00:00Z')),
    ).toBe('expired');
  });

  it('returns critical when nearest policy is within 14 days', () => {
    const profile = {
      ...baseProfile,
      workersComp: {
        ...baseProfile.workersComp,
        expiryDate: '2026-08-10',
      },
    };
    expect(
      worstPolicySeverity(profile, new Date('2026-08-01T00:00:00Z')),
    ).toBe('critical');
  });
});

describe('combinedEachOccurrenceCents', () => {
  it('stacks GL + umbrella when both have each-occurrence', () => {
    expect(combinedEachOccurrenceCents(baseProfile)).toBe(7_000_000_00);
  });

  it('returns GL alone when umbrella is absent', () => {
    const { umbrella, ...rest } = baseProfile;
    void umbrella;
    expect(combinedEachOccurrenceCents(rest)).toBe(2_000_000_00);
  });

  it('returns null when GL each-occurrence is unspecified', () => {
    const profile = {
      ...baseProfile,
      generalLiability: {
        ...baseProfile.generalLiability,
        eachOccurrenceLimitCents: null,
      },
    };
    expect(combinedEachOccurrenceCents(profile)).toBeNull();
  });
});
