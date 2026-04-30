import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioW9Snapshot } from './portfolio-w9-snapshot';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2024-01-01',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioW9Snapshot', () => {
  it('classifies W-9s as current / stale / missing W-9 / missing date', () => {
    const r = buildPortfolioW9Snapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', w9CollectedOn: '2024-01-01' }), // current (within 3y)
        vend({ id: 'b', w9CollectedOn: '2022-01-01' }), // stale (>3y)
        vend({ id: 'c', w9OnFile: false }), // missing W9
        vend({ id: 'd', w9CollectedOn: undefined }), // missing date
      ],
    });
    expect(r.totalReportable).toBe(4);
    expect(r.currentCount).toBe(1);
    expect(r.staleCount).toBe(1);
    expect(r.missingW9Count).toBe(1);
    expect(r.missingDateCount).toBe(1);
  });

  it('skips not-reportable vendors', () => {
    const r = buildPortfolioW9Snapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [vend({ id: 'a', is1099Reportable: false })],
    });
    expect(r.totalReportable).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioW9Snapshot({ vendors: [] });
    expect(r.totalReportable).toBe(0);
  });
});
