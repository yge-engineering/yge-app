import { describe, expect, it } from 'vitest';
import { computeBidChecklist } from './bid-checklist';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';

function fullyClearEstimate(): PricedEstimate {
  return {
    id: 'est-1',
    fromDraftId: 'd1',
    jobId: 'cltest000000000000000000',
    createdAt: '2026-04-24T00:00:00Z',
    updatedAt: '2026-04-24T00:00:00Z',
    projectName: 'Full clear',
    projectType: 'DRAINAGE',
    ownerAgency: 'Caltrans',
    bidDueDate: '2026-04-30',
    bidItems: [
      {
        itemNumber: '1',
        description: 'Mob',
        unit: 'LS',
        quantity: 1,
        confidence: 'HIGH',
        unitPriceCents: 100_000_00,
      },
    ],
    oppPercent: 0.2,
    subBids: [
      {
        id: 'sub-1',
        contractorName: 'Acme Trucking',
        portionOfWork: 'Off-haul',
        bidAmountCents: 25_000_00,
      },
    ],
    bidSecurity: { type: 'BID_BOND', percent: 0.1 },
    addenda: [
      {
        id: 'add-1',
        number: '1',
        acknowledged: true,
      },
    ],
  };
}

function totals(direct: number, opp: number, unpriced = 0): PricedEstimateTotals {
  return {
    directCents: direct,
    oppCents: opp,
    bidTotalCents: direct + opp,
    unpricedLineCount: unpriced,
  };
}

describe('computeBidChecklist', () => {
  it('all-pass when nothing is missing', () => {
    const e = fullyClearEstimate();
    const t = totals(100_000_00, 20_000_00, 0);
    const c = computeBidChecklist(e, t);
    expect(c.allClear).toBe(true);
    expect(c.readyToSubmit).toBe(true);
    expect(c.blockerFailCount).toBe(0);
    expect(c.recommendedWarnCount).toBe(0);
    expect(c.items.every((i) => i.status === 'pass')).toBe(true);
  });

  it('flags unpriced lines as a blocker fail', () => {
    const e = fullyClearEstimate();
    const t = totals(0, 0, 3);
    const c = computeBidChecklist(e, t);
    expect(c.readyToSubmit).toBe(false);
    expect(c.blockerFailCount).toBeGreaterThan(0);
    const linesItem = c.items.find((i) => i.id === 'lines-priced');
    expect(linesItem?.status).toBe('fail');
    expect(linesItem?.severity).toBe('blocker');
    expect(linesItem?.detail).toMatch(/3 lines/);
  });

  it('flags un-acked addenda as a blocker fail', () => {
    const e = fullyClearEstimate();
    e.addenda = [
      { id: 'add-1', number: '1', acknowledged: false },
      { id: 'add-2', number: '2', acknowledged: true },
    ];
    const t = totals(100_000_00, 20_000_00);
    const c = computeBidChecklist(e, t);
    const item = c.items.find((i) => i.id === 'addenda-acknowledged');
    expect(item?.status).toBe('fail');
    expect(item?.severity).toBe('blocker');
    expect(item?.detail).toMatch(/1 addendum/);
    expect(c.readyToSubmit).toBe(false);
  });

  it('flags missing bid security as a recommended warn (not blocker)', () => {
    const e = fullyClearEstimate();
    e.bidSecurity = undefined;
    const t = totals(100_000_00, 20_000_00);
    const c = computeBidChecklist(e, t);
    expect(c.readyToSubmit).toBe(true); // still ready — recommended only
    expect(c.allClear).toBe(false);
    const item = c.items.find((i) => i.id === 'bid-security');
    expect(item?.status).toBe('warn');
    expect(item?.severity).toBe('recommended');
  });

  it('flags missing owner agency as a recommended warn', () => {
    const e = fullyClearEstimate();
    e.ownerAgency = undefined;
    const t = totals(100_000_00, 20_000_00);
    const c = computeBidChecklist(e, t);
    const item = c.items.find((i) => i.id === 'owner-agency');
    expect(item?.status).toBe('warn');
    expect(c.readyToSubmit).toBe(true);
  });

  it('warns on empty sub list when bid total exceeds threshold', () => {
    const e = fullyClearEstimate();
    e.subBids = [];
    // Bid total $1M → §4104 threshold $10K (highway floor). We're well over.
    const t = totals(900_000_00, 100_000_00);
    const c = computeBidChecklist(e, t);
    const item = c.items.find((i) => i.id === 'sub-list');
    expect(item?.status).toBe('warn');
  });

  it('passes empty sub list when bid total is below threshold', () => {
    const e = fullyClearEstimate();
    e.subBids = [];
    e.projectType = 'OTHER'; // non-highway, plain 0.5% threshold
    // Bid total $500 → 0.5% threshold = $2.50, but we have no subs at all,
    // so the threshold check passes (nothing to list).
    const t = totals(500_00, 0);
    const c = computeBidChecklist(e, t);
    const item = c.items.find((i) => i.id === 'sub-list');
    expect(item?.status).toBe('pass');
  });

  it('zero bid total is a blocker fail', () => {
    const e = fullyClearEstimate();
    const t = totals(0, 0);
    const c = computeBidChecklist(e, t);
    const item = c.items.find((i) => i.id === 'bid-total-positive');
    expect(item?.status).toBe('fail');
    expect(c.readyToSubmit).toBe(false);
  });

  it('counts recommendedWarnCount independently of blockers', () => {
    const e = fullyClearEstimate();
    e.ownerAgency = undefined;
    e.bidDueDate = undefined;
    e.bidSecurity = undefined;
    const t = totals(100_000_00, 20_000_00);
    const c = computeBidChecklist(e, t);
    expect(c.recommendedWarnCount).toBe(3);
    expect(c.blockerFailCount).toBe(0);
    expect(c.readyToSubmit).toBe(true);
    expect(c.allClear).toBe(false);
  });
});
