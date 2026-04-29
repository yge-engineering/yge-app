import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorByState } from './vendor-by-state';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'ACME Construction',
    kind: 'SUPPLIER',
    paymentTerms: 'NET_30',
    state: 'CA',
    w9OnFile: true,
    coiOnFile: false,
    is1099Reportable: false,
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorByState', () => {
  it('groups vendors by state (uppercased)', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'a', state: 'CA' }),
        vend({ id: 'b', state: 'ca' }),
        vend({ id: 'c', state: 'NV' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const ca = r.rows.find((x) => x.state === 'CA');
    expect(ca?.total).toBe(2);
  });

  it('breaks down by kind per state', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'a', kind: 'SUPPLIER' }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR' }),
      ],
    });
    expect(r.rows[0]?.byKind.SUPPLIER).toBe(1);
    expect(r.rows[0]?.byKind.SUBCONTRACTOR).toBe(2);
  });

  it('counts on-hold vendors per state', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'live' }),
        vend({ id: 'hold', onHold: true }),
      ],
    });
    expect(r.rows[0]?.onHoldCount).toBe(1);
  });

  it('counts subs missing COI per state', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'sub-no-coi', kind: 'SUBCONTRACTOR', coiOnFile: false }),
        vend({ id: 'sub-coi', kind: 'SUBCONTRACTOR', coiOnFile: true }),
        vend({ id: 'supplier', kind: 'SUPPLIER', coiOnFile: false }),
      ],
    });
    expect(r.rows[0]?.missingCoiSubs).toBe(1);
  });

  it('counts unattributed vendors (no state) on rollup', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'a', state: 'CA' }),
        vend({ id: 'b', state: undefined }),
        vend({ id: 'c', state: '' }),
      ],
    });
    expect(r.rollup.totalVendors).toBe(3);
    expect(r.rollup.unattributed).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by total desc', () => {
    const r = buildVendorByState({
      vendors: [
        vend({ id: 'a', state: 'NV' }),
        vend({ id: 'b', state: 'CA' }),
        vend({ id: 'c', state: 'CA' }),
        vend({ id: 'd', state: 'CA' }),
      ],
    });
    expect(r.rows[0]?.state).toBe('CA');
  });

  it('handles empty input', () => {
    const r = buildVendorByState({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
