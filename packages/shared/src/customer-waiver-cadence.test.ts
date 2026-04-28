import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildCustomerWaiverCadence } from './customer-waiver-cadence';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'DELIVERED',
    ownerName: 'CAL FIRE',
    jobName: 'Sulphur Springs',
    claimantName: 'Young General Engineering, Inc.',
    paymentAmountCents: 50_000_00,
    throughDate: '2026-04-15',
    signedOn: '2026-04-15',
    deliveredOn: '2026-04-18',
    ...over,
  } as LienWaiver;
}

describe('buildCustomerWaiverCadence', () => {
  it('groups by canonicalized owner/customer name', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({ id: 'a', ownerName: 'CAL FIRE' }),
        lw({ id: 'b', ownerName: 'Cal Fire' }),
        lw({ id: 'c', ownerName: 'cal fire' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalWaivers).toBe(3);
  });

  it('counts delivered + signed-not-delivered + draft separately', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({ id: 'd1' }),  // DELIVERED
        lw({ id: 's1', status: 'SIGNED', deliveredOn: undefined }),
        lw({ id: 'dr', status: 'DRAFT', signedOn: undefined, deliveredOn: undefined }),
      ],
    });
    const row = r.rows[0];
    expect(row?.delivered).toBe(1);
    expect(row?.signedNotDelivered).toBe(1);
    expect(row?.draftCount).toBe(1);
  });

  it('skips VOIDED waivers entirely', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({ id: 'a' }),
        lw({ id: 'voided', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.totalWaivers).toBe(1);
  });

  it('computes avg + median days from signedOn to deliveredOn', () => {
    // 3 days, 5 days, 10 days deltas
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({ id: 'a', signedOn: '2026-04-01', deliveredOn: '2026-04-04' }),
        lw({ id: 'b', signedOn: '2026-04-10', deliveredOn: '2026-04-15' }),
        lw({ id: 'c', signedOn: '2026-04-20', deliveredOn: '2026-04-30' }),
      ],
    });
    const row = r.rows[0];
    // mean = 6, median = 5
    expect(row?.avgDaysToDeliver).toBe(6);
    expect(row?.medianDaysToDeliver).toBe(5);
  });

  it('captures oldest undelivered age in days vs asOf', () => {
    const r = buildCustomerWaiverCadence({
      asOf: '2026-04-30',
      waivers: [
        lw({ id: 'old', status: 'SIGNED', signedOn: '2026-04-01', deliveredOn: undefined }),
        lw({ id: 'new', status: 'SIGNED', signedOn: '2026-04-25', deliveredOn: undefined }),
      ],
    });
    expect(r.rows[0]?.oldestUndeliveredAgeDays).toBe(29);
  });

  it('null oldest undelivered when none', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [lw({ id: 'a' })], // delivered
    });
    expect(r.rows[0]?.oldestUndeliveredAgeDays).toBe(null);
  });

  it('null avg/median when no delivered waivers', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({ id: 'a', status: 'SIGNED', deliveredOn: undefined }),
      ],
    });
    expect(r.rows[0]?.avgDaysToDeliver).toBe(null);
    expect(r.rows[0]?.medianDaysToDeliver).toBe(null);
  });

  it('rolls up portfolio delivered $ + blended avg', () => {
    const r = buildCustomerWaiverCadence({
      waivers: [
        lw({
          id: 'a',
          ownerName: 'CAL FIRE',
          signedOn: '2026-04-01',
          deliveredOn: '2026-04-05',
          paymentAmountCents: 100_000_00,
        }),
        lw({
          id: 'b',
          ownerName: 'Caltrans',
          signedOn: '2026-04-10',
          deliveredOn: '2026-04-12',
          paymentAmountCents: 50_000_00,
        }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(2);
    expect(r.rollup.blendedAvgDaysToDeliver).toBe(3);
  });

  it('sorts customers with most signed-not-delivered first', () => {
    const r = buildCustomerWaiverCadence({
      asOf: '2026-04-30',
      waivers: [
        // CAL FIRE — clean, all delivered
        lw({ id: 'a', ownerName: 'CAL FIRE' }),
        // Caltrans — 2 stuck
        lw({ id: 'b', ownerName: 'Caltrans', status: 'SIGNED', signedOn: '2026-04-15', deliveredOn: undefined }),
        lw({ id: 'c', ownerName: 'Caltrans', status: 'SIGNED', signedOn: '2026-04-20', deliveredOn: undefined }),
        // County — 1 stuck
        lw({ id: 'd', ownerName: 'Shasta County', status: 'SIGNED', signedOn: '2026-04-22', deliveredOn: undefined }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Caltrans');
    expect(r.rows[1]?.customerName).toBe('Shasta County');
  });
});
