import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorOnholdByKind } from './vendor-onhold-by-kind';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'A',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    coiOnFile: true,
    is1099Reportable: true,
    onHold: true,
    ...over,
  } as Vendor;
}

describe('buildVendorOnholdByKind', () => {
  it('only counts on-hold vendors', () => {
    const r = buildVendorOnholdByKind({
      vendors: [
        vend({ id: 'on' }),
        vend({ id: 'off', onHold: false }),
      ],
    });
    expect(r.rollup.totalOnHold).toBe(1);
  });

  it('groups by kind', () => {
    const r = buildVendorOnholdByKind({
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'c', kind: 'SUPPLIER' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts missing-COI subs separately', () => {
    const r = buildVendorOnholdByKind({
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR', coiOnFile: false }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR', coiOnFile: true }),
        vend({ id: 'c', kind: 'SUPPLIER', coiOnFile: false }),
      ],
    });
    const sub = r.rows.find((x) => x.kind === 'SUBCONTRACTOR');
    expect(sub?.missingCoiCount).toBe(1);
  });

  it('counts missing-W9 1099-reportable vendors', () => {
    const r = buildVendorOnholdByKind({
      vendors: [
        vend({ id: 'a', is1099Reportable: true, w9OnFile: false }),
        vend({ id: 'b', is1099Reportable: true, w9OnFile: true }),
      ],
    });
    expect(r.rows[0]?.missingW9Count).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildVendorOnholdByKind({
      vendors: [
        vend({ id: 'a', kind: 'SUPPLIER' }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR' }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('SUBCONTRACTOR');
  });

  it('handles empty input', () => {
    const r = buildVendorOnholdByKind({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
