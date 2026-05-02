import { describe, expect, it } from 'vitest';
import {
  MasterProfileSchema,
  isSensitivePath,
  newInsurancePolicyId,
  newOfficerId,
  resolveProfilePath,
  type MasterProfile,
} from './master-profile';

function profile(over: Partial<MasterProfile> = {}): MasterProfile {
  return MasterProfileSchema.parse({
    id: 'master',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    legalName: 'Young General Engineering, Inc.',
    shortName: 'YGE',
    cslbLicense: '1145219',
    dirNumber: '2000018967',
    dotNumber: '4528204',
    naicsCodes: ['115310'],
    pscCodes: ['F003', 'F004'],
    address: {
      street: '19645 Little Woods Rd',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
    },
    primaryPhone: '707-499-7065',
    primaryEmail: 'info@youngge.com',
    officers: [
      { id: 'officer-1', name: 'Brook L. Young', title: 'President', roleKey: 'president', phone: '707-499-7065', email: 'brookyoung@youngge.com' },
      { id: 'officer-2', name: 'Ryan D. Young', title: 'Vice President', roleKey: 'vp', phone: '707-599-9921', email: 'ryoung@youngge.com' },
    ],
    insurance: [
      { id: 'pol-1', kind: 'GENERAL_LIABILITY', carrierName: 'Travelers', policyNumber: 'GL-12345', effectiveDate: '2026-01-01', expiresOn: '2027-01-01', perOccurrenceCents: 2_000_000_00, aggregateCents: 4_000_000_00 },
    ],
    ...over,
  });
}

describe('id helpers', () => {
  it('newOfficerId follows the pattern', () => {
    expect(newOfficerId()).toMatch(/^officer-[0-9a-f]{8}$/);
  });
  it('newInsurancePolicyId follows the pattern', () => {
    expect(newInsurancePolicyId()).toMatch(/^pol-[0-9a-f]{8}$/);
  });
});

describe('MasterProfileSchema', () => {
  it('rejects a malformed federal EIN', () => {
    expect(() => profile({ federalEin: '12345678' })).toThrow();
  });
  it('accepts a well-formed federal EIN', () => {
    const p = profile({ federalEin: '12-3456789' });
    expect(p.federalEin).toBe('12-3456789');
  });
  it('rejects a malformed NAICS code', () => {
    expect(() => profile({ naicsCodes: ['1153'] })).toThrow();
  });
  it('rejects a non-2-letter state code', () => {
    expect(() =>
      profile({
        address: {
          street: '1 Main', city: 'Cottonwood', state: 'CAL', zip: '96022',
        },
      }),
    ).toThrow();
  });
  it('accepts a 9-digit ZIP', () => {
    const p = profile({
      address: {
        street: '1 Main', city: 'Cottonwood', state: 'CA', zip: '96022-1234',
      },
    });
    expect(p.address.zip).toBe('96022-1234');
  });
});

describe('resolveProfilePath', () => {
  const p = profile();

  it('walks dotted paths into nested objects', () => {
    expect(resolveProfilePath(p, 'cslbLicense')).toBe('1145219');
    expect(resolveProfilePath(p, 'address.street')).toBe('19645 Little Woods Rd');
    expect(resolveProfilePath(p, 'address.city')).toBe('Cottonwood');
  });

  it('walks arrays via numeric index', () => {
    expect(resolveProfilePath(p, 'officers.0.name')).toBe('Brook L. Young');
    expect(resolveProfilePath(p, 'officers.1.name')).toBe('Ryan D. Young');
  });

  it('walks arrays via roleKey shortcut', () => {
    expect(resolveProfilePath(p, 'officers.president.name')).toBe('Brook L. Young');
    expect(resolveProfilePath(p, 'officers.vp.email')).toBe('ryoung@youngge.com');
  });

  it('walks insurance via kind shortcut', () => {
    expect(resolveProfilePath(p, 'insurance.GENERAL_LIABILITY.carrierName')).toBe('Travelers');
  });

  it('returns undefined for unresolved paths', () => {
    expect(resolveProfilePath(p, 'does.not.exist')).toBeUndefined();
    expect(resolveProfilePath(p, 'officers.does-not-exist.name')).toBeUndefined();
  });

  it('returns undefined when walking past a non-object', () => {
    expect(resolveProfilePath(p, 'cslbLicense.foo')).toBeUndefined();
  });
});

describe('isSensitivePath', () => {
  it('returns false for ordinary paths', () => {
    expect(isSensitivePath('cslbLicense')).toBe(false);
    expect(isSensitivePath('officers.president.name')).toBe(false);
  });
});
