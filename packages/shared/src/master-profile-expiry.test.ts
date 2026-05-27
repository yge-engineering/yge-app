import { describe, expect, it } from 'vitest';

import {
  classifyExpiry,
  collectExpiringItems,
  daysUntil,
} from './master-profile-expiry';
import type { MasterProfile } from './master-profile';

// Anchor "now" to a fixed date so the date math is deterministic.
// Picking 2026-05-27 (Wednesday) — neither leap-year boundary nor
// month edge.
const NOW = new Date('2026-05-27T12:00:00Z');

function makeProfile(overrides: Partial<MasterProfile>): MasterProfile {
  return {
    id: 'master',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    legalName: 'Young General Engineering, Inc.',
    shortName: 'YGE',
    cslbLicense: '1145219',
    cslbClassifications: ['A'],
    dirNumber: '2000018967',
    naicsCodes: [],
    pscCodes: [],
    address: {
      street: '19645 Little Woods Rd',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
    },
    primaryPhone: '707-499-7065',
    primaryEmail: 'brookyoung@youngge.com',
    officers: [],
    insurance: [],
    isDbe: false,
    isSbe: false,
    isDvbe: false,
    isWbe: false,
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil('2026-05-27', NOW)).toBe(0);
  });

  it('returns 1 for tomorrow', () => {
    expect(daysUntil('2026-05-28', NOW)).toBe(1);
  });

  it('returns -1 for yesterday', () => {
    expect(daysUntil('2026-05-26', NOW)).toBe(-1);
  });

  it('returns 30 for 30 days out', () => {
    expect(daysUntil('2026-06-26', NOW)).toBe(30);
  });

  it('returns -10 for 10 days past', () => {
    expect(daysUntil('2026-05-17', NOW)).toBe(-10);
  });
});

describe('classifyExpiry', () => {
  it('classifies negative days as expired', () => {
    expect(classifyExpiry(-1)).toBe('expired');
    expect(classifyExpiry(-100)).toBe('expired');
  });

  it('classifies 0-30 days as critical', () => {
    expect(classifyExpiry(0)).toBe('critical');
    expect(classifyExpiry(15)).toBe('critical');
    expect(classifyExpiry(30)).toBe('critical');
  });

  it('classifies 31-60 days as warn', () => {
    expect(classifyExpiry(31)).toBe('warn');
    expect(classifyExpiry(45)).toBe('warn');
    expect(classifyExpiry(60)).toBe('warn');
  });

  it('returns null for items far out', () => {
    expect(classifyExpiry(61)).toBeNull();
    expect(classifyExpiry(365)).toBeNull();
  });
});

describe('collectExpiringItems', () => {
  it('returns empty array when nothing is expiring', () => {
    const profile = makeProfile({
      cslbExpiresOn: '2027-01-01',
      dirExpiresOn: '2027-06-01',
    });
    expect(collectExpiringItems(profile, NOW)).toEqual([]);
  });

  it('picks up an expired CSLB', () => {
    const profile = makeProfile({ cslbExpiresOn: '2026-05-01' });
    const items = collectExpiringItems(profile, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: 'CSLB license',
      expiresOn: '2026-05-01',
      tone: 'expired',
    });
    expect(items[0]!.daysRemaining).toBeLessThan(0);
  });

  it('picks up a critical DIR registration', () => {
    const profile = makeProfile({ dirExpiresOn: '2026-06-10' });
    const items = collectExpiringItems(profile, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: 'DIR registration',
      tone: 'critical',
    });
  });

  it('picks up an insurance policy with kind + carrier in label', () => {
    const profile = makeProfile({
      insurance: [
        {
          id: 'ins-1',
          kind: 'GENERAL_LIABILITY',
          carrierName: 'Travelers',
          policyNumber: 'TX-12345',
          effectiveDate: '2025-07-01',
          expiresOn: '2026-07-15',
          perOccurrenceCents: 0,
          aggregateCents: 0,
          acordCertOnFile: true,
        },
      ],
    });
    const items = collectExpiringItems(profile, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toContain('GENERAL_LIABILITY');
    expect(items[0]!.label).toContain('Travelers');
    expect(items[0]!.tone).toBe('warn');
  });

  it('sorts most-urgent first', () => {
    const profile = makeProfile({
      cslbExpiresOn: '2026-07-20',  // 54d out → warn
      dirExpiresOn: '2026-05-15',   // 12d ago → expired
      insurance: [
        {
          id: 'ins-1',
          kind: 'AUTOMOBILE_LIABILITY',
          carrierName: 'Geico',
          policyNumber: 'A-1',
          effectiveDate: '2025-07-01',
          expiresOn: '2026-06-15',  // 19d out → critical
          perOccurrenceCents: 0,
          aggregateCents: 0,
          acordCertOnFile: false,
        },
      ],
    });
    const items = collectExpiringItems(profile, NOW);
    expect(items).toHaveLength(3);
    expect(items[0]!.label).toBe('DIR registration');  // most urgent (expired)
    expect(items[1]!.label).toContain('AUTOMOBILE_LIABILITY');
    expect(items[2]!.label).toBe('CSLB license');
  });

  it('ignores records with no expiresOn', () => {
    const profile = makeProfile({
      cslbExpiresOn: undefined,
      dirExpiresOn: undefined,
    });
    expect(collectExpiringItems(profile, NOW)).toEqual([]);
  });

  it('ignores records far in the future', () => {
    const profile = makeProfile({
      cslbExpiresOn: '2028-01-01',
      dirExpiresOn: '2030-01-01',
    });
    expect(collectExpiringItems(profile, NOW)).toEqual([]);
  });
});
