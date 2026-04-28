import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorCoiAging } from './vendor-coi-aging';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'ACME Construction',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    coiOnFile: true,
    coiExpiresOn: '2026-12-31',
    is1099Reportable: true,
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorCoiAging', () => {
  it('only considers SUBCONTRACTOR vendors', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'sub' }),
        vend({ id: 'sup', kind: 'SUPPLIER' }),
        vend({ id: 'pro', kind: 'PROFESSIONAL' }),
      ],
    });
    expect(r.rollup.subsConsidered).toBe(1);
  });

  it('tiers EXPIRED, EXPIRES_SOON, CURRENT, NO_COI', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'expired', coiExpiresOn: '2026-04-01' }),
        vend({ id: 'soon', coiExpiresOn: '2026-05-15' }),
        vend({ id: 'current', coiExpiresOn: '2026-12-31' }),
        vend({ id: 'none', coiOnFile: false, coiExpiresOn: undefined }),
      ],
    });
    expect(r.rollup.expired).toBe(1);
    expect(r.rollup.expiresSoon).toBe(1);
    expect(r.rollup.current).toBe(1);
    expect(r.rollup.noCoi).toBe(1);
  });

  it('computes daysToExpiry correctly (negative = past due)', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'past', coiExpiresOn: '2026-04-23' }),
        vend({ id: 'future', coiExpiresOn: '2026-05-03' }),
      ],
    });
    const past = r.rows.find((x) => x.vendorId === 'past');
    const future = r.rows.find((x) => x.vendorId === 'future');
    expect(past?.daysToExpiry).toBe(-5);
    expect(future?.daysToExpiry).toBe(5);
  });

  it('respects custom soonDays window', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      soonDays: 14,
      vendors: [
        vend({ id: 'soonNarrow', coiExpiresOn: '2026-05-05' }), // 7 days, within 14
        vend({ id: 'currentNarrow', coiExpiresOn: '2026-06-15' }), // 48 days, past 14
      ],
    });
    expect(r.rollup.expiresSoon).toBe(1);
    expect(r.rollup.current).toBe(1);
  });

  it('treats coiOnFile=true but missing coiExpiresOn as NO_COI', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [vend({ coiOnFile: true, coiExpiresOn: undefined })],
    });
    expect(r.rollup.noCoi).toBe(1);
    expect(r.rows[0]?.tier).toBe('NO_COI');
  });

  it('sorts EXPIRED first, then EXPIRES_SOON ascending, then CURRENT, then NO_COI', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'cur', coiExpiresOn: '2026-12-31' }),
        vend({ id: 'none', coiOnFile: false, coiExpiresOn: undefined }),
        vend({ id: 'soon-far', coiExpiresOn: '2026-05-25' }),
        vend({ id: 'expired', coiExpiresOn: '2026-04-01' }),
        vend({ id: 'soon-near', coiExpiresOn: '2026-05-03' }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('expired');
    expect(r.rows[1]?.vendorId).toBe('soon-near');
    expect(r.rows[2]?.vendorId).toBe('soon-far');
    expect(r.rows[3]?.vendorId).toBe('cur');
    expect(r.rows[4]?.vendorId).toBe('none');
  });

  it('uses dbaName when present, falls back to legalName', () => {
    const r = buildVendorCoiAging({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'a', legalName: 'ABC Inc.', dbaName: 'ABC Trucking' }),
        vend({ id: 'b', legalName: 'XYZ Corp', dbaName: undefined }),
      ],
    });
    expect(r.rows.find((x) => x.vendorId === 'a')?.vendorName).toBe('ABC Trucking');
    expect(r.rows.find((x) => x.vendorId === 'b')?.vendorName).toBe('XYZ Corp');
  });

  it('handles empty input', () => {
    const r = buildVendorCoiAging({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
