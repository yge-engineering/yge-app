import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorW9ByCollectedMonthly } from './vendor-w9-by-collected-monthly';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2026-04-15',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorW9ByCollectedMonthly', () => {
  it('groups by collected month', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2026-04-15' }),
        vend({ id: 'b', w9CollectedOn: '2026-04-22' }),
        vend({ id: 'c', w9CollectedOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts W-9s per month', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2026-04-15' }),
        vend({ id: 'b', w9CollectedOn: '2026-04-22' }),
      ],
    });
    expect(r.rows[0]?.w9sCollected).toBe(2);
  });

  it('breaks down by kind', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'c', kind: 'TRUCKING' }),
      ],
    });
    expect(r.rows[0]?.byKind.SUBCONTRACTOR).toBe(2);
    expect(r.rows[0]?.byKind.TRUCKING).toBe(1);
  });

  it('counts reportable subset', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', is1099Reportable: true }),
        vend({ id: 'b', is1099Reportable: false }),
      ],
    });
    expect(r.rows[0]?.reportableCount).toBe(1);
  });

  it('skips vendors with no w9OnFile or missing collected date', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', w9OnFile: false }),
        vend({ id: 'b', w9OnFile: true, w9CollectedOn: undefined }),
        vend({ id: 'c' }),
      ],
    });
    expect(r.rollup.totalW9s).toBe(1);
    expect(r.rollup.noCollectedDateSkipped).toBe(1);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildVendorW9ByCollectedMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      vendors: [
        vend({ id: 'old', w9CollectedOn: '2026-03-15' }),
        vend({ id: 'in', w9CollectedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalW9s).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildVendorW9ByCollectedMonthly({
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2026-06-15' }),
        vend({ id: 'b', w9CollectedOn: '2026-04-15' }),
        vend({ id: 'c', w9CollectedOn: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildVendorW9ByCollectedMonthly({ vendors: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalW9s).toBe(0);
  });
});
