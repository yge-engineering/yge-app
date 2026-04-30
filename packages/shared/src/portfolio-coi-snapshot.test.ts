import { describe, expect, it } from 'vitest';

import type { Vendor } from './vendor';

import { buildPortfolioCoiSnapshot } from './portfolio-coi-snapshot';

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
    coiExpiresOn: '2027-04-15',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildPortfolioCoiSnapshot', () => {
  it('classifies COIs as current / expiring soon / expired / none', () => {
    const r = buildPortfolioCoiSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      soonDays: 30,
      vendors: [
        vend({ id: 'a', coiExpiresOn: '2027-04-15' }), // current
        vend({ id: 'b', coiExpiresOn: '2026-05-01' }), // soon
        vend({ id: 'c', coiExpiresOn: '2026-03-15' }), // expired
        vend({ id: 'd', coiOnFile: false }), // no coi
      ],
    });
    expect(r.totalSubs).toBe(4);
    expect(r.currentCount).toBe(1);
    expect(r.expiringSoonCount).toBe(1);
    expect(r.expiredCount).toBe(1);
    expect(r.noCoiCount).toBe(1);
  });

  it('only counts SUBCONTRACTOR vendors', () => {
    const r = buildPortfolioCoiSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'SUPPLIER' }),
      ],
    });
    expect(r.totalSubs).toBe(1);
  });

  it('counts onHold separately', () => {
    const r = buildPortfolioCoiSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      vendors: [
        vend({ id: 'a', onHold: true }),
        vend({ id: 'b', onHold: false }),
      ],
    });
    expect(r.onHoldCount).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoiSnapshot({ vendors: [] });
    expect(r.totalSubs).toBe(0);
  });
});
