import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioW9MonthlyExpiring } from './portfolio-w9-monthly-expiring';

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

describe('buildPortfolioW9MonthlyExpiring', () => {
  it('buckets vendors by collectedOn + 3 years', () => {
    const r = buildPortfolioW9MonthlyExpiring({
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2023-04-15' }),
        vend({ id: 'b', w9CollectedOn: '2023-05-01' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-05');
  });

  it('breaks down by VendorKind', () => {
    const r = buildPortfolioW9MonthlyExpiring({
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR', w9CollectedOn: '2023-04-15' }),
        vend({ id: 'b', kind: 'TRUCKING', w9CollectedOn: '2023-04-15' }),
      ],
    });
    expect(r.rows[0]?.byKind.SUBCONTRACTOR).toBe(1);
    expect(r.rows[0]?.byKind.TRUCKING).toBe(1);
  });

  it('skips not-reportable / no-w9 / no-date', () => {
    const r = buildPortfolioW9MonthlyExpiring({
      vendors: [
        vend({ id: 'a', is1099Reportable: false }),
        vend({ id: 'b', w9OnFile: false }),
        vend({ id: 'c', w9CollectedOn: undefined }),
        vend({ id: 'd' }),
      ],
    });
    expect(r.rollup.notReportableSkipped).toBe(1);
    expect(r.rollup.noW9Skipped).toBe(1);
    expect(r.rollup.noCollectedDateSkipped).toBe(1);
    expect(r.rollup.totalW9s).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioW9MonthlyExpiring({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      vendors: [
        vend({ id: 'old', w9CollectedOn: '2023-03-15' }),
        vend({ id: 'in', w9CollectedOn: '2023-04-15' }),
      ],
    });
    expect(r.rollup.totalW9s).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioW9MonthlyExpiring({
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2023-06-15' }),
        vend({ id: 'b', w9CollectedOn: '2023-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioW9MonthlyExpiring({ vendors: [] });
    expect(r.rows).toHaveLength(0);
  });
});
