import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioVendorSnapshot } from './portfolio-vendor-snapshot';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    state: 'CA',
    is1099Reportable: false,
    w9OnFile: true,
    w9CollectedOn: '2025-01-01',
    coiOnFile: true,
    coiExpiresOn: '2030-12-31',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioVendorSnapshot', () => {
  it('counts total + kind + state + onHold + 1099', () => {
    const r = buildPortfolioVendorSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR', state: 'CA', is1099Reportable: true }),
        vend({ id: 'b', kind: 'SUPPLIER', state: 'NV', onHold: true }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR', state: 'CA' }),
      ],
    });
    expect(r.totalVendors).toBe(3);
    expect(r.byKind.SUBCONTRACTOR).toBe(2);
    expect(r.byKind.SUPPLIER).toBe(1);
    expect(r.byState.CA).toBe(2);
    expect(r.byState.NV).toBe(1);
    expect(r.onHoldCount).toBe(1);
    expect(r.reportable1099Count).toBe(1);
  });

  it('counts W-9 + COI freshness', () => {
    const r = buildPortfolioVendorSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a' }),
        vend({ id: 'b', kind: 'SUPPLIER', w9OnFile: false }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR', coiOnFile: false }),
      ],
    });
    expect(r.w9CurrentCount).toBe(2);
    expect(r.subcontractorCount).toBe(2);
    expect(r.coiCurrentSubsCount).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorSnapshot({ vendors: [] });
    expect(r.totalVendors).toBe(0);
  });
});
