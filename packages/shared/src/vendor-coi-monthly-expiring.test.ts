import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorCoiMonthlyExpiring } from './vendor-coi-monthly-expiring';

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
    coiExpiresOn: '2026-06-15',
    is1099Reportable: true,
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorCoiMonthlyExpiring', () => {
  it('only counts SUBCONTRACTOR vendors', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'sub' }),
        vend({ id: 'sup', kind: 'SUPPLIER' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('skips already-expired COIs', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [vend({ coiExpiresOn: '2026-01-01' })],
    });
    expect(r.rollup.total).toBe(0);
  });

  it('skips missing coiExpiresOn', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [vend({ coiExpiresOn: undefined })],
    });
    expect(r.rollup.total).toBe(0);
  });

  it('buckets by month', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2026-06-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-06-30' }),
        vend({ id: 'c', coiExpiresOn: '2026-08-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const jun = r.rows.find((x) => x.month === '2026-06');
    expect(jun?.total).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      fromMonth: '2026-06',
      toMonth: '2026-06',
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2026-06-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-08-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildVendorCoiMonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2026-08-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-06-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildVendorCoiMonthlyExpiring({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
