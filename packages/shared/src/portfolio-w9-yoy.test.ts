import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioW9Yoy } from './portfolio-w9-yoy';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2023-04-15',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioW9Yoy', () => {
  it('compares prior vs current refresh deadlines', () => {
    const r = buildPortfolioW9Yoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2022-04-15' }), // refresh 2025
        vend({ id: 'b', w9CollectedOn: '2023-04-15' }), // refresh 2026
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
  });

  it('breaks down by VendorKind', () => {
    const r = buildPortfolioW9Yoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'TRUCKING' }),
      ],
    });
    expect(r.currentByKind.SUBCONTRACTOR).toBe(1);
    expect(r.currentByKind.TRUCKING).toBe(1);
  });

  it('skips not-reportable / no-w9 / no-date', () => {
    const r = buildPortfolioW9Yoy({
      currentYear: 2026,
      vendors: [
        vend({ id: 'a', is1099Reportable: false }),
        vend({ id: 'b', w9OnFile: false }),
        vend({ id: 'c', w9CollectedOn: undefined }),
        vend({ id: 'd', w9CollectedOn: '2023-04-15' }),
      ],
    });
    expect(r.currentTotal).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioW9Yoy({ currentYear: 2026, vendors: [] });
    expect(r.currentTotal).toBe(0);
  });
});
