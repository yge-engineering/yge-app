import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioCoiMonthlyExpiring } from './portfolio-coi-monthly-expiring';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: false,
    w9OnFile: false,
    coiOnFile: true,
    coiExpiresOn: '2026-04-15',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioCoiMonthlyExpiring', () => {
  it('groups by expiry month', () => {
    const r = buildPortfolioCoiMonthlyExpiring({
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2026-04-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-04-22' }),
        vend({ id: 'c', coiExpiresOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts distinct vendors + onHold', () => {
    const r = buildPortfolioCoiMonthlyExpiring({
      vendors: [
        vend({ id: 'a', onHold: true }),
        vend({ id: 'b', onHold: false }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
    expect(r.rows[0]?.onHoldCount).toBe(1);
  });

  it('skips non-subs, no-coi, no-expiry', () => {
    const r = buildPortfolioCoiMonthlyExpiring({
      vendors: [
        vend({ id: 'a', kind: 'SUPPLIER' }),
        vend({ id: 'b', coiOnFile: false }),
        vend({ id: 'c', coiOnFile: true, coiExpiresOn: undefined }),
        vend({ id: 'd' }),
      ],
    });
    expect(r.rollup.nonSubSkipped).toBe(1);
    expect(r.rollup.noCoiOnFileSkipped).toBe(1);
    expect(r.rollup.noExpirySkipped).toBe(1);
    expect(r.rollup.totalCois).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCoiMonthlyExpiring({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      vendors: [
        vend({ id: 'old', coiExpiresOn: '2026-03-15' }),
        vend({ id: 'in', coiExpiresOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCois).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCoiMonthlyExpiring({
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2026-06-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoiMonthlyExpiring({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
