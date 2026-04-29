import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildVendor1099StatusMix } from './vendor-1099-status-mix';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'ACME',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    w9CollectedOn: '2026-01-01',
    coiOnFile: false,
    is1099Reportable: true,
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildVendor1099StatusMix', () => {
  it('classifies READY when reportable + W9 + current', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2026-01-01' })],
    });
    const ready = r.rows.find((x) => x.tier === 'READY');
    expect(ready?.total).toBe(1);
  });

  it('classifies MISSING_W9 when reportable but no W9', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ is1099Reportable: true, w9OnFile: false, w9CollectedOn: undefined })],
    });
    const miss = r.rows.find((x) => x.tier === 'MISSING_W9');
    expect(miss?.total).toBe(1);
  });

  it('classifies STALE_W9 when W9 > 3 years old', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2020-01-01' })],
    });
    const stale = r.rows.find((x) => x.tier === 'STALE_W9');
    expect(stale?.total).toBe(1);
  });

  it('classifies NOT_REPORTABLE when not flagged', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ is1099Reportable: false })],
    });
    const nr = r.rows.find((x) => x.tier === 'NOT_REPORTABLE');
    expect(nr?.total).toBe(1);
  });

  it('rolls up reportable total + need-attention count', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [
        vend({ id: 'a', is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2026-01-01' }),
        vend({ id: 'b', is1099Reportable: true, w9OnFile: false }),
        vend({ id: 'c', is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2020-01-01' }),
        vend({ id: 'd', is1099Reportable: false }),
      ],
    });
    expect(r.rollup.totalVendors).toBe(4);
    expect(r.rollup.reportableTotal).toBe(3);
    expect(r.rollup.readyCount).toBe(1);
    expect(r.rollup.needAttention).toBe(2);
  });

  it('breaks down by kind per tier', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR', is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2026-01-01' }),
        vend({ id: 'b', kind: 'PROFESSIONAL', is1099Reportable: true, w9OnFile: true, w9CollectedOn: '2026-01-01' }),
      ],
    });
    const ready = r.rows.find((x) => x.tier === 'READY');
    expect(ready?.byKind.SUBCONTRACTOR).toBe(1);
    expect(ready?.byKind.PROFESSIONAL).toBe(1);
  });

  it('returns all four tier rows even when zero', () => {
    const r = buildVendor1099StatusMix({
      asOf: new Date('2026-04-28'),
      vendors: [vend({ is1099Reportable: false })],
    });
    expect(r.rows).toHaveLength(4);
  });

  it('handles empty input', () => {
    const r = buildVendor1099StatusMix({ vendors: [] });
    expect(r.rollup.totalVendors).toBe(0);
  });
});
