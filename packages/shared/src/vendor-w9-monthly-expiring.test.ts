import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendorW9MonthlyExpiring } from './vendor-w9-monthly-expiring';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'A',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    w9CollectedOn: '2024-04-15',
    coiOnFile: false,
    is1099Reportable: true,
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendorW9MonthlyExpiring', () => {
  it('only counts 1099-reportable vendors', () => {
    const r = buildVendorW9MonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [
        vend({ id: 'rep' }),
        vend({ id: 'norep', is1099Reportable: false }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('skips vendors with no W-9 on file', () => {
    const r = buildVendorW9MonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [vend({ w9OnFile: false, w9CollectedOn: undefined })],
    });
    expect(r.rollup.total).toBe(0);
  });

  it('skips W-9s already expired (collectedOn + 3yr < asOf)', () => {
    const r = buildVendorW9MonthlyExpiring({
      asOf: '2026-04-28',
      vendors: [vend({ w9CollectedOn: '2020-01-01' })],
    });
    expect(r.rollup.total).toBe(0);
  });

  it('buckets by expiry month (collectedOn + 3 years)', () => {
    // collected 2023-04-15 → expires ~2026-04-14
    // collected 2024-08-15 → expires ~2027-08-14
    const r = buildVendorW9MonthlyExpiring({
      asOf: '2026-04-01',
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2023-04-15' }),
        vend({ id: 'b', w9CollectedOn: '2024-08-15' }),
      ],
    });
    expect(r.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildVendorW9MonthlyExpiring({
      asOf: '2026-04-28',
      fromMonth: '2027-01',
      toMonth: '2027-12',
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2024-08-15' }), // expires 2027-08
        vend({ id: 'b', w9CollectedOn: '2025-08-15' }), // expires 2028-08
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildVendorW9MonthlyExpiring({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
