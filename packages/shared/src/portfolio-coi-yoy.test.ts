import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioCoiYoy } from './portfolio-coi-yoy';

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

describe('buildPortfolioCoiYoy', () => {
  it('compares prior vs current totals + delta', () => {
    const r = buildPortfolioCoiYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2025-04-15' }),
        vend({ id: 'b', coiExpiresOn: '2026-04-15' }),
        vend({ id: 'c', coiExpiresOn: '2026-05-01' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('counts onHold per year', () => {
    const r = buildPortfolioCoiYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', onHold: true }),
        vend({ id: 'b', onHold: false }),
      ],
    });
    expect(r.currentOnHoldCount).toBe(1);
  });

  it('skips non-subs / no-coi / no-expiry', () => {
    const r = buildPortfolioCoiYoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', kind: 'SUPPLIER' }),
        vend({ id: 'b', coiOnFile: false }),
        vend({ id: 'c', coiExpiresOn: undefined }),
        vend({ id: 'd' }),
      ],
    });
    expect(r.currentTotal).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoiYoy({ currentYear: 2026, vendors: [] });
    expect(r.currentTotal).toBe(0);
  });
});
