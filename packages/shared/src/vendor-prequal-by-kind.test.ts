import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorPrequalByKind } from './vendor-prequal-by-kind';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2026-01-01',
    coiOnFile: true,
    coiExpiresOn: '2026-12-31',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorPrequalByKind', () => {
  it('groups by VendorKind', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'TRUCKING' }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('flags ready when W-9 + COI + not onHold', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'ready', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'noCoi', kind: 'SUBCONTRACTOR', coiOnFile: false }),
      ],
    });
    expect(r.rows[0]?.ready).toBe(1);
    expect(r.rows[0]?.missingCoiSubs).toBe(1);
  });

  it('counts missingW9 across all kinds', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'sub', kind: 'SUBCONTRACTOR', w9OnFile: false }),
        vend({ id: 'sup', kind: 'SUPPLIER', w9OnFile: false }),
      ],
    });
    expect(r.rollup.totalMissingW9).toBe(2);
  });

  it('only counts missingCoi for SUBCONTRACTOR kind', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'sub', kind: 'SUBCONTRACTOR', coiOnFile: false }),
        vend({ id: 'sup', kind: 'SUPPLIER', coiOnFile: false }),
      ],
    });
    expect(r.rollup.totalMissingCoi).toBe(1);
  });

  it('counts onHold separately', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', onHold: true }),
        vend({ id: 'b', onHold: false }),
      ],
    });
    expect(r.rollup.totalOnHold).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildVendorPrequalByKind({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', kind: 'TRUCKING' }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR' }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('SUBCONTRACTOR');
    expect(r.rows[0]?.total).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildVendorPrequalByKind({ vendors: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalVendors).toBe(0);
  });
});
