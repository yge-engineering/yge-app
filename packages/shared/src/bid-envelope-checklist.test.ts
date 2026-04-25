import { describe, expect, it } from 'vitest';
import { buildEnvelopeChecklist } from './bid-envelope-checklist';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';

function makeEstimate(overrides: Partial<PricedEstimate> = {}): PricedEstimate {
  return {
    id: 'est-001',
    fromDraftId: 'drf-001',
    jobId: 'job-2026-04-30-sulphur-springs-deadbeef',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    projectName: 'Sulphur Springs Soquol Road',
    projectType: 'DRAINAGE',
    bidDueDate: 'April 30, 2026 2:00 PM',
    bidItems: [
      {
        itemNumber: '1',
        description: 'Mobilization',
        unit: 'LS',
        quantity: 1,
        confidence: 'HIGH',
        unitPriceCents: 5_000_000,
      },
    ],
    oppPercent: 0.2,
    subBids: [],
    addenda: [],
    ...overrides,
  };
}

const TOTALS: PricedEstimateTotals = {
  directCents: 5_000_000,
  oppCents: 1_000_000,
  bidTotalCents: 6_000_000,
  unpricedLineCount: 0,
};

describe('buildEnvelopeChecklist', () => {
  it('always lists sealed bid form, license, DIR, cover letter', () => {
    const c = buildEnvelopeChecklist(makeEstimate(), TOTALS);
    const ids = c.items.map((i) => i.id);
    expect(ids).toContain('sealed-bid-form');
    expect(ids).toContain('cover-letter');
    expect(ids).toContain('cslb-cert');
    expect(ids).toContain('dir-cert');
  });

  it('flags missing bid security as a warning', () => {
    const c = buildEnvelopeChecklist(makeEstimate(), TOTALS);
    const sec = c.items.find((i) => i.id === 'bid-security-missing');
    expect(sec).toBeDefined();
    expect(sec?.severity).toBe('required');
    expect(sec?.warn).toBe(true);
    expect(c.allRequiredAccountedFor).toBe(false);
  });

  it('shows configured bid security with surety + amount', () => {
    const c = buildEnvelopeChecklist(
      makeEstimate({
        bidSecurity: {
          type: 'BID_BOND',
          percent: 0.1,
          suretyName: 'Old Republic Surety',
          bondNumber: 'OR-1234',
        },
      }),
      TOTALS,
    );
    const sec = c.items.find((i) => i.id === 'bid-security');
    expect(sec).toBeDefined();
    expect(sec?.detail).toContain('Old Republic Surety');
    expect(sec?.detail).toContain('OR-1234');
    expect(sec?.detail).toContain('$600,000.00');
    expect(sec?.warn).toBeFalsy();
  });

  it('omits the sub list row when there are no subs', () => {
    const c = buildEnvelopeChecklist(makeEstimate(), TOTALS);
    expect(c.items.some((i) => i.id === 'sub-list')).toBe(false);
  });

  it('adds the sub list row when there are subs', () => {
    const c = buildEnvelopeChecklist(
      makeEstimate({
        subBids: [
          {
            id: 'sub-1',
            contractorName: 'Cottonwood Paving',
            portionOfWork: 'Asphalt paving',
            bidAmountCents: 50_000_000,
          },
        ],
      }),
      TOTALS,
    );
    expect(c.items.some((i) => i.id === 'sub-list')).toBe(true);
  });

  it('warns when any addenda are un-acknowledged', () => {
    const c = buildEnvelopeChecklist(
      makeEstimate({
        addenda: [
          { id: 'a-1', number: '1', acknowledged: true },
          { id: 'a-2', number: '2', acknowledged: false },
        ],
      }),
      TOTALS,
    );
    const ack = c.items.find((i) => i.id === 'addenda-bundle');
    expect(ack).toBeDefined();
    expect(ack?.warn).toBe(true);
    expect(ack?.detail).toContain('STILL UN-ACKED');
  });

  it('does not warn when addenda are all acknowledged', () => {
    const c = buildEnvelopeChecklist(
      makeEstimate({
        bidSecurity: { type: 'BID_BOND', percent: 0.1, suretyName: 'X' },
        addenda: [{ id: 'a-1', number: '1', acknowledged: true }],
      }),
      TOTALS,
    );
    const ack = c.items.find((i) => i.id === 'addenda-bundle');
    expect(ack?.warn).toBeFalsy();
    expect(c.allRequiredAccountedFor).toBe(true);
  });

  it('reports allRequiredAccountedFor=false when any required row warns', () => {
    const c = buildEnvelopeChecklist(makeEstimate(), TOTALS);
    expect(c.allRequiredAccountedFor).toBe(false); // missing security warns
  });

  it('reports allRequiredAccountedFor=true when nothing warns', () => {
    const c = buildEnvelopeChecklist(
      makeEstimate({
        bidSecurity: { type: 'BID_BOND', percent: 0.1, suretyName: 'X' },
      }),
      TOTALS,
    );
    expect(c.allRequiredAccountedFor).toBe(true);
  });

  it('includes the bid due date in the recommended envelope-marked row', () => {
    const c = buildEnvelopeChecklist(makeEstimate(), TOTALS);
    const env = c.items.find((i) => i.id === 'envelope-marked');
    expect(env?.detail).toContain('April 30, 2026 2:00 PM');
  });
});
