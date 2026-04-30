import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioVendorPrequalYoy } from './portfolio-vendor-prequal-yoy';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2025-06-15T00:00:00.000Z',
    updatedAt: '2025-06-15T00:00:00.000Z',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: false,
    w9OnFile: true,
    w9CollectedOn: '2025-01-01',
    coiOnFile: true,
    coiExpiresOn: '2030-12-31',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioVendorPrequalYoy', () => {
  it('compares year-end vendor counts + ready', () => {
    const r = buildPortfolioVendorPrequalYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', createdAt: '2025-01-15T00:00:00Z' }),
        vend({ id: 'b', createdAt: '2026-06-15T00:00:00Z' }),
      ],
    });
    expect(r.prior.totalVendors).toBe(1);
    expect(r.current.totalVendors).toBe(2);
    expect(r.totalVendorsDelta).toBe(1);
  });

  it('counts missingW9 + missingCoi (subs only) + onHold', () => {
    const r = buildPortfolioVendorPrequalYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', w9OnFile: false }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR', coiOnFile: false }),
        vend({ id: 'c', kind: 'SUPPLIER', coiOnFile: false }),
        vend({ id: 'd', onHold: true }),
      ],
    });
    expect(r.current.missingW9Count).toBe(1);
    expect(r.current.missingCoiSubsCount).toBe(1);
    expect(r.current.onHoldCount).toBe(1);
  });

  it('counts ready (W-9 + COI for subs + not onHold)', () => {
    const r = buildPortfolioVendorPrequalYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'ready' }),
        vend({ id: 'noW9', w9OnFile: false }),
      ],
    });
    expect(r.current.readyCount).toBe(1);
  });

  it('skips vendors created after snapshot date', () => {
    const r = buildPortfolioVendorPrequalYoy({
      currentYear: 2026,
      vendors: [vend({ id: 'a', createdAt: '2027-01-15T00:00:00Z' })],
    });
    expect(r.current.totalVendors).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorPrequalYoy({ currentYear: 2026, vendors: [] });
    expect(r.current.totalVendors).toBe(0);
  });
});
