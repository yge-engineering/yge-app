import { describe, it, expect } from 'vitest';

import {
  masterProfileToBondingProfile,
  masterProfileToInsuranceProfile,
} from './master-profile-adapter';
import type { MasterProfileBonding, MasterProfileInsurancePolicy } from './master-profile';

const sampleBonding: MasterProfileBonding = {
  suretyName: 'Liberty Mutual',
  agentName: 'Westland Brokers',
  agentPhone: '707-555-0001',
  agentEmail: 'agent@westland.example',
  singleJobLimitCents: 10_000_000_00,
  aggregateLimitCents: 25_000_000_00,
  notes: 'capacity confirmed 4/22',
};

const samplePolicy = (
  override: Partial<MasterProfileInsurancePolicy>,
): MasterProfileInsurancePolicy => ({
  id: 'p-test',
  kind: 'GENERAL_LIABILITY',
  carrierName: 'Travelers',
  policyNumber: 'GL-001',
  effectiveDate: '2026-03-01',
  expiresOn: '2027-03-01',
  perOccurrenceCents: 2_000_000_00,
  aggregateCents: 4_000_000_00,
  acordCertOnFile: true,
  ...override,
});

describe('masterProfileToBondingProfile', () => {
  it('returns null when source is undefined', () => {
    expect(
      masterProfileToBondingProfile(undefined, {
        currentBondedWorkOnHandCents: 0,
        renewalDate: '2027-01-01',
      }),
    ).toBeNull();
  });

  it('maps fields and merges agent phone+email', () => {
    const out = masterProfileToBondingProfile(sampleBonding, {
      currentBondedWorkOnHandCents: 8_000_000_00,
      renewalDate: '2027-01-01',
    });
    expect(out).not.toBeNull();
    expect(out?.suretyName).toBe('Liberty Mutual');
    expect(out?.agentName).toBe('Westland Brokers');
    expect(out?.agentContact).toBe('707-555-0001 · agent@westland.example');
    expect(out?.singleProjectCapacityCents).toBe(10_000_000_00);
    expect(out?.aggregateCapacityCents).toBe(25_000_000_00);
    expect(out?.currentBondedWorkOnHandCents).toBe(8_000_000_00);
    expect(out?.renewalDate).toBe('2027-01-01');
  });

  it('handles missing agent phone gracefully', () => {
    const { agentPhone, ...rest } = sampleBonding;
    void agentPhone;
    const out = masterProfileToBondingProfile(rest, {
      currentBondedWorkOnHandCents: 0,
      renewalDate: '2027-01-01',
    });
    expect(out?.agentContact).toBe('agent@westland.example');
  });

  it('drops agentContact when both phone + email empty', () => {
    const { agentPhone, agentEmail, ...rest } = sampleBonding;
    void agentPhone;
    void agentEmail;
    const out = masterProfileToBondingProfile(rest, {
      currentBondedWorkOnHandCents: 0,
      renewalDate: '2027-01-01',
    });
    expect(out?.agentContact).toBeUndefined();
  });
});

describe('masterProfileToInsuranceProfile', () => {
  it('returns null when GL is missing', () => {
    expect(masterProfileToInsuranceProfile([])).toBeNull();
  });

  it('returns null when only GL exists (Auto + WC required)', () => {
    expect(
      masterProfileToInsuranceProfile([samplePolicy({ kind: 'GENERAL_LIABILITY' })]),
    ).toBeNull();
  });

  it('builds full profile when GL+Auto+WC present', () => {
    const out = masterProfileToInsuranceProfile([
      samplePolicy({ id: 'gl', kind: 'GENERAL_LIABILITY', carrierName: 'TR' }),
      samplePolicy({ id: 'auto', kind: 'AUTOMOBILE_LIABILITY', carrierName: 'PR' }),
      samplePolicy({ id: 'wc', kind: 'WORKERS_COMP', carrierName: 'SF' }),
    ]);
    expect(out).not.toBeNull();
    expect(out?.generalLiability.carrier).toBe('TR');
    expect(out?.commercialAuto.carrier).toBe('PR');
    expect(out?.workersComp.carrier).toBe('SF');
    expect(out?.umbrella).toBeUndefined();
  });

  it('picks latest-expiry policy when multiple of same kind', () => {
    const out = masterProfileToInsuranceProfile([
      samplePolicy({ id: 'gl-old', kind: 'GENERAL_LIABILITY', expiresOn: '2025-12-01' }),
      samplePolicy({ id: 'gl-new', kind: 'GENERAL_LIABILITY', expiresOn: '2027-03-01', policyNumber: 'GL-002' }),
      samplePolicy({ id: 'auto', kind: 'AUTOMOBILE_LIABILITY' }),
      samplePolicy({ id: 'wc', kind: 'WORKERS_COMP' }),
    ]);
    expect(out?.generalLiability.policyNumber).toBe('GL-002');
  });

  it('includes umbrella when present', () => {
    const out = masterProfileToInsuranceProfile([
      samplePolicy({ id: 'gl', kind: 'GENERAL_LIABILITY' }),
      samplePolicy({ id: 'auto', kind: 'AUTOMOBILE_LIABILITY' }),
      samplePolicy({ id: 'wc', kind: 'WORKERS_COMP' }),
      samplePolicy({ id: 'um', kind: 'EXCESS_UMBRELLA', carrierName: 'Lloyd\'s' }),
    ]);
    expect(out?.umbrella?.carrier).toBe('Lloyd\'s');
  });

  it('passes broker note through when broker name present', () => {
    const out = masterProfileToInsuranceProfile([
      samplePolicy({ id: 'gl', kind: 'GENERAL_LIABILITY', brokerName: 'Westland', brokerPhone: '707-555-0001' }),
      samplePolicy({ id: 'auto', kind: 'AUTOMOBILE_LIABILITY' }),
      samplePolicy({ id: 'wc', kind: 'WORKERS_COMP' }),
    ]);
    expect(out?.generalLiability.brokerNote).toMatch(/Westland/);
    expect(out?.generalLiability.brokerNote).toMatch(/707-555-0001/);
  });

  it('coerces zero per-occurrence to null', () => {
    const out = masterProfileToInsuranceProfile([
      samplePolicy({ id: 'gl', kind: 'GENERAL_LIABILITY', perOccurrenceCents: 0 }),
      samplePolicy({ id: 'auto', kind: 'AUTOMOBILE_LIABILITY' }),
      samplePolicy({ id: 'wc', kind: 'WORKERS_COMP' }),
    ]);
    expect(out?.generalLiability.eachOccurrenceLimitCents).toBeNull();
  });
});
