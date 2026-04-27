import { describe, expect, it } from 'vitest';
import { buildSubListAudit } from './sub-list-audit';
import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

function sub(over: Partial<SubBid>): SubBid {
  return {
    id: 'sub-1',
    contractorName: 'Acme Subs',
    address: '1 Main St',
    cslbLicense: '999999',
    dirRegistration: '1000000123',
    portionOfWork: 'Site grading',
    bidAmountCents: 50_000_00,
    ...over,
  } as SubBid;
}

function estimate(over: Partial<PricedEstimate>): PricedEstimate {
  return {
    id: 'est-1',
    fromDraftId: 'draft-1',
    jobId: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    bidItems: [],
    oppPercent: 0.2,
    subBids: [],
    addenda: [],
    ...over,
  } as PricedEstimate;
}

describe('buildSubListAudit', () => {
  it('responsive=true when no must-list subs are missing fields', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [sub({ bidAmountCents: 50_000_00 })],
      }),
      bidTotalCents: 1_000_000_00, // §4104 threshold ≈ $5,000 (highway floor); $50k is must-list
    });
    expect(r.responsive).toBe(true);
    expect(r.blockerCount).toBe(0);
  });

  it('flags BLOCKER when must-list sub is missing CSLB', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [sub({ bidAmountCents: 50_000_00, cslbLicense: undefined })],
      }),
      bidTotalCents: 1_000_000_00,
    });
    expect(r.blockerCount).toBe(1);
    expect(r.responsive).toBe(false);
    expect(r.issues[0]?.missing).toContain('cslbLicense');
  });

  it('flags multiple missing fields on the same sub', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [
          sub({
            bidAmountCents: 50_000_00,
            cslbLicense: undefined,
            dirRegistration: undefined,
            address: undefined,
          }),
        ],
      }),
      bidTotalCents: 1_000_000_00,
    });
    expect(r.issues[0]?.missing).toEqual(
      expect.arrayContaining(['address', 'cslbLicense', 'dirRegistration']),
    );
  });

  it('skips OPTIONAL (under-threshold) subs from auditing', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'OTHER',
        // OTHER uses 0.5% of bid (no highway floor); bid total
        // $10M → threshold $50k.
        subBids: [
          sub({
            bidAmountCents: 100_00, // way under threshold → OPTIONAL
            cslbLicense: undefined,
            dirRegistration: undefined,
          }),
        ],
      }),
      bidTotalCents: 10_000_000_00,
    });
    expect(r.issues).toHaveLength(0);
    expect(r.responsive).toBe(true);
  });

  it('issues sorted BLOCKER first, then by bid amount desc', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [
          sub({ id: 'small-bad', bidAmountCents: 10_000_00, cslbLicense: undefined }),
          sub({ id: 'big-bad', bidAmountCents: 100_000_00, cslbLicense: undefined }),
        ],
      }),
      bidTotalCents: 5_000_000_00,
    });
    expect(r.issues.map((x) => x.subId)).toEqual(['big-bad', 'small-bad']);
  });

  it('handles missing portionOfWork as a blocker', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [sub({ bidAmountCents: 50_000_00, portionOfWork: '' })],
      }),
      bidTotalCents: 1_000_000_00,
    });
    expect(r.blockerCount).toBe(1);
    expect(r.issues[0]?.missing).toContain('portionOfWork');
  });

  it('detail string differs between BLOCKER and WARNING', () => {
    const r = buildSubListAudit({
      estimate: estimate({
        projectType: 'ROAD_RECONSTRUCTION',
        subBids: [sub({ bidAmountCents: 50_000_00, cslbLicense: undefined })],
      }),
      bidTotalCents: 1_000_000_00,
    });
    expect(r.issues[0]?.detail).toContain('tossed at bid open');
  });
});
