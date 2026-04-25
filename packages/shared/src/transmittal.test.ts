import { describe, expect, it } from 'vitest';
import { buildTransmittal, computeEnclosures } from './transmittal';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';
import { YGE_COMPANY_INFO } from './company';

function makeEstimate(overrides: Partial<PricedEstimate> = {}): PricedEstimate {
  return {
    id: 'est-001',
    fromDraftId: 'drf-001',
    jobId: 'job-2026-04-30-sulphur-springs-deadbeef',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    projectName: 'Sulphur Springs Soquol Road',
    projectType: 'DRAINAGE',
    location: 'Cottonwood, CA',
    ownerAgency: 'City of Cottonwood',
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

describe('buildTransmittal', () => {
  it('builds a complete letter with company header, addressee, body, and signer', () => {
    const t = buildTransmittal(makeEstimate(), TOTALS, {
      date: 'April 24, 2026',
    });
    expect(t.date).toBe('April 24, 2026');
    expect(t.subjectLine).toBe('RE: Bid for Sulphur Springs Soquol Road');
    expect(t.companyHeader.legalName).toBe('Young General Engineering, Inc.');
    expect(t.companyHeader.cslbLicense).toBe('1145219');
    expect(t.addressee.agency).toBe('City of Cottonwood');
    expect(t.salutation).toBe('To Whom It May Concern,');
    expect(t.closing.signer.name).toBe('Ryan D. Young');
    expect(t.closing.signer.title).toBe('Vice President');
  });

  it('includes the bid total and due date in the opening paragraph', () => {
    const t = buildTransmittal(makeEstimate(), TOTALS, {
      date: 'April 24, 2026',
    });
    const opening = t.bodyParagraphs[0];
    expect(opening).toContain('$60,000.00');
    expect(opening).toContain('April 30, 2026 2:00 PM');
    expect(opening).toContain('Sulphur Springs Soquol Road');
    expect(opening).toContain('Cottonwood, CA');
  });

  it('drops the due-date phrase when bidDueDate is missing', () => {
    const t = buildTransmittal(
      makeEstimate({ bidDueDate: undefined }),
      TOTALS,
      { date: 'April 24, 2026' },
    );
    expect(t.bodyParagraphs[0]).not.toContain('bid opening on');
  });

  it('uses the configured signer when provided', () => {
    const t = buildTransmittal(makeEstimate(), TOTALS, {
      date: 'April 24, 2026',
      signer: YGE_COMPANY_INFO.president,
    });
    expect(t.closing.signer.name).toBe('Brook L. Young');
    expect(t.closing.signer.title).toBe('President');
  });

  it('switches the salutation when an attention line is provided', () => {
    const t = buildTransmittal(makeEstimate(), TOTALS, {
      date: 'April 24, 2026',
      addressee: {
        agency: 'City of Cottonwood',
        attention: 'Office of the City Clerk',
        addressLines: ['3300 Brickyard Rd', 'Cottonwood, CA 96022'],
      },
    });
    expect(t.salutation).toBe('Attention: Office of the City Clerk,');
    expect(t.addressee.addressLines).toEqual([
      '3300 Brickyard Rd',
      'Cottonwood, CA 96022',
    ]);
  });

  it('includes a custom note when supplied', () => {
    const t = buildTransmittal(makeEstimate(), TOTALS, {
      date: 'April 24, 2026',
      customNote: 'Our project manager attended the mandatory site walk.',
    });
    expect(t.bodyParagraphs).toContain(
      'Our project manager attended the mandatory site walk.',
    );
  });

  it('falls back to a placeholder agency when ownerAgency is missing', () => {
    const t = buildTransmittal(
      makeEstimate({ ownerAgency: undefined }),
      TOTALS,
      { date: 'April 24, 2026' },
    );
    expect(t.addressee.agency).toBe('[Awarding Agency]');
  });
});

describe('computeEnclosures', () => {
  it('always lists the bid form, license, and DIR registration', () => {
    const e = computeEnclosures(makeEstimate(), TOTALS, YGE_COMPANY_INFO);
    const labels = e.map((x) => x.label);
    expect(labels).toContain('Sealed bid form');
    expect(labels).toContain('Contractor\u2019s license certificate');
    expect(labels).toContain('DIR public works registration');
  });

  it('adds the \u00a74104 sub list when the estimate has subs', () => {
    const e = computeEnclosures(
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
      YGE_COMPANY_INFO,
    );
    expect(e.some((x) => x.label.includes('subcontractor'))).toBe(true);
  });

  it('flags un-acked addenda in the enclosures detail', () => {
    const e = computeEnclosures(
      makeEstimate({
        addenda: [
          {
            id: 'add-1',
            number: '1',
            acknowledged: true,
          },
          {
            id: 'add-2',
            number: '2',
            acknowledged: false,
          },
        ],
      }),
      TOTALS,
      YGE_COMPANY_INFO,
    );
    const ack = e.find((x) => x.label === 'Addenda acknowledgments');
    expect(ack).toBeDefined();
    expect(ack?.detail).toContain('SEE BID FORM');
  });

  it('omits the bid-security row when no security is configured', () => {
    const e = computeEnclosures(makeEstimate(), TOTALS, YGE_COMPANY_INFO);
    expect(e.some((x) => x.label === 'Bid security')).toBe(false);
  });

  it('includes the security type when present', () => {
    const e = computeEnclosures(
      makeEstimate({
        bidSecurity: {
          type: 'BID_BOND',
          percent: 0.1,
          suretyName: 'Old Republic Surety',
        },
      }),
      TOTALS,
      YGE_COMPANY_INFO,
    );
    const sec = e.find((x) => x.label === 'Bid security');
    expect(sec).toBeDefined();
    expect(sec?.detail).toContain('Old Republic Surety');
  });
});
