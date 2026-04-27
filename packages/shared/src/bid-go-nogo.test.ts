import { describe, expect, it } from 'vitest';
import { buildBidGoNogo } from './bid-go-nogo';
import type { PricedEstimate } from './priced-estimate';

function est(over: Partial<PricedEstimate>): PricedEstimate {
  return {
    id: 'est-1',
    fromDraftId: 'draft-1',
    jobId: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test Job',
    projectType: 'ROAD_RECONSTRUCTION',
    bidItems: [
      { description: 'Mobilization', quantity: 1, unitPriceCents: 50_000_00, unit: 'LS' } as never,
    ],
    oppPercent: 0.2,
    subBids: [],
    addenda: [],
    bidSecurity: { type: 'BID_BOND', percent: 0.1 } as never,
    ...over,
  } as PricedEstimate;
}

describe('buildBidGoNogo', () => {
  it('clean estimate is ready=true', () => {
    const r = buildBidGoNogo(est({}));
    // Clean estimate should have no PRICING/ADDENDA/SUB_LIST blockers.
    expect(r.ready).toBe(true);
    expect(r.unackedAddendaCount).toBe(0);
    expect(r.unpricedLineCount).toBe(0);
  });

  it('blocks when un-acknowledged addenda exist', () => {
    const r = buildBidGoNogo(
      est({
        addenda: [
          { number: 1, issuedOn: '2026-04-20', acknowledged: false } as never,
        ],
      }),
    );
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.source === 'ADDENDA')).toBe(true);
  });

  it('blocks when any line is unpriced', () => {
    const r = buildBidGoNogo(
      est({
        bidItems: [
          { description: 'a', quantity: 1, unitPriceCents: 100_00, unit: 'LS' } as never,
          { description: 'b', quantity: 1, unitPriceCents: null, unit: 'LS' } as never,
        ],
      }),
    );
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.source === 'PRICING')).toBe(true);
  });

  it('warns (not blocks) when bid security is missing', () => {
    const r = buildBidGoNogo(est({ bidSecurity: undefined }));
    expect(r.warnings.some((w) => w.source === 'BID_SECURITY')).toBe(true);
    // Warnings don't block — readiness depends only on blockers.
    expect(r.ready).toBe(true);
  });

  it('blocks on §4104 must-list sub missing required fields', () => {
    const r = buildBidGoNogo(
      est({
        subBids: [
          {
            id: 'sub-1',
            contractorName: 'BigSub Inc',
            cslbLicense: undefined,
            dirRegistration: undefined,
            address: '1 main',
            portionOfWork: 'paving',
            bidAmountCents: 100_000_00, // must-list under PCC §4104
          } as never,
        ],
        bidItems: [
          { description: 'x', quantity: 1, unitPriceCents: 1_000_000_00, unit: 'LS' } as never,
        ],
      }),
    );
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.source === 'SUB_LIST_AUDIT')).toBe(true);
  });

  it('echoes intermediates so UI can deep-link', () => {
    const r = buildBidGoNogo(est({}));
    expect(r.bidChecklistItems.length).toBeGreaterThan(0);
    expect(typeof r.bidTotalCents).toBe('number');
  });
});
