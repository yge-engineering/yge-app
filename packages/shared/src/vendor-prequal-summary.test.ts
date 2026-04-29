import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorPrequalSummary } from './vendor-prequal-summary';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'A',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    w9CollectedOn: '2026-01-01',
    coiOnFile: true,
    coiExpiresOn: '2027-01-01',
    is1099Reportable: true,
    onHold: false,
    cslbLicense: '123456',
    dirRegistration: '2000099999',
    ...over,
  } as Vendor;
}

describe('buildVendorPrequalSummary', () => {
  it('only counts SUBCONTRACTOR vendors', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [
        vend({ id: 'sub' }),
        vend({ id: 'sup', kind: 'SUPPLIER' }),
      ],
    });
    expect(r.rollup.subsConsidered).toBe(1);
  });

  it('classifies READY when all checks pass', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({})],
    });
    const ready = r.rows.find((x) => x.tier === 'READY');
    expect(ready?.count).toBe(1);
  });

  it('classifies NEEDS_W9 when W-9 missing/expired', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ w9OnFile: false })],
    });
    const t = r.rows.find((x) => x.tier === 'NEEDS_W9');
    expect(t?.count).toBe(1);
  });

  it('classifies NEEDS_COI', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ coiOnFile: false, coiExpiresOn: undefined })],
    });
    const t = r.rows.find((x) => x.tier === 'NEEDS_COI');
    expect(t?.count).toBe(1);
  });

  it('classifies NEEDS_CSLB', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ cslbLicense: undefined })],
    });
    const t = r.rows.find((x) => x.tier === 'NEEDS_CSLB');
    expect(t?.count).toBe(1);
  });

  it('classifies NEEDS_DIR', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ dirRegistration: undefined })],
    });
    const t = r.rows.find((x) => x.tier === 'NEEDS_DIR');
    expect(t?.count).toBe(1);
  });

  it('classifies ON_HOLD takes precedence', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ onHold: true, w9OnFile: false })],
    });
    const t = r.rows.find((x) => x.tier === 'ON_HOLD');
    expect(t?.count).toBe(1);
  });

  it('returns six rows in fixed order', () => {
    const r = buildVendorPrequalSummary({
      asOf: new Date('2026-04-28'),
      vendors: [vend({})],
    });
    expect(r.rows.map((x) => x.tier)).toEqual([
      'READY', 'NEEDS_W9', 'NEEDS_COI', 'NEEDS_CSLB', 'NEEDS_DIR', 'ON_HOLD',
    ]);
  });

  it('handles empty input', () => {
    const r = buildVendorPrequalSummary({ vendors: [] });
    expect(r.rollup.subsConsidered).toBe(0);
  });
});
