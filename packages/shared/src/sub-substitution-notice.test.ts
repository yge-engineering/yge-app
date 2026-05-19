import { describe, expect, it } from 'vitest';
import {
  buildSubstitutionNotice,
  listSubstitutionGrounds,
} from './sub-substitution-notice';
import type { SubBid } from './sub-bid';
import { YGE_COMPANY_INFO } from './company';

function makeSub(overrides: Partial<SubBid> = {}): SubBid {
  return {
    id: 'sub-00000001',
    contractorName: 'Acme Striping LLC',
    address: '123 Industrial Way, Redding, CA 96002',
    cslbLicense: '999999',
    dirRegistration: '1000000111',
    portionOfWork: 'Striping and pavement markings',
    bidAmountCents: 35_000_00,
    ...overrides,
  };
}

const ESTIMATE = {
  projectName: 'Sulphur Springs Soquol Road',
  ownerAgency: 'City of Cottonwood',
  location: 'Cottonwood, CA',
};

describe('listSubstitutionGrounds', () => {
  it('returns every statutory ground with a label and statute reference', () => {
    const grounds = listSubstitutionGrounds();
    expect(grounds.length).toBeGreaterThanOrEqual(8);
    for (const g of grounds) {
      expect(g.value).toBeTruthy();
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.statuteRef).toMatch(/^PCC §4107/);
    }
  });
});

describe('buildSubstitutionNotice', () => {
  it('addresses the awarding authority and names the project + statute ground', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.addressee.agency).toBe('City of Cottonwood');
    expect(n.subjectLine).toBe(
      'Request for Subcontractor Substitution under PCC §4107(a)(3) — Sulphur Springs Soquol Road',
    );
    expect(n.salutation).toBe('To the Awarding Authority,');
    expect(n.groundLabel).toBe('Failure or refusal to perform the listed work');
    expect(n.groundStatuteRef).toBe('PCC §4107(a)(3)');
  });

  it('includes the original sub block with portion of work + bid amount', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.originalSub.contractorName).toBe('Acme Striping LLC');
    expect(n.originalSub.portionOfWork).toBe('Striping and pavement markings');
    expect(n.originalSub.bidAmountUsd).toBe('$35,000.00');
    expect(n.originalSub.cslbLicense).toBe('999999');
  });

  it('quotes the §4104 statutory body sentence for the chosen ground', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'BANKRUPTCY', {
      date: 'May 19, 2026',
    });
    expect(n.groundStatement).toContain('bankrupt or insolvent');
  });

  it('mentions the objection window in the boilerplate body', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.bodyParagraphs.join(' ')).toContain('5 working days');
  });

  it('honors a custom objection window', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
      objectionWindowWorkingDays: 10,
    });
    expect(n.bodyParagraphs.join(' ')).toContain('10 working days');
  });

  it('renders no replacement block when none is provided', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.replacementProposal).toBeNull();
    expect(n.closingParagraph).toContain('as soon as the substitution is approved');
  });

  it('renders a replacement block when one is provided', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
      replacement: {
        contractorName: 'North State Lines, Inc.',
        address: '500 Linecoat Rd, Anderson, CA 96007',
        cslbLicense: '888888',
        dirRegistration: '1000000222',
        bidAmountCents: 36_500_00,
      },
    });
    expect(n.replacementProposal).not.toBeNull();
    expect(n.replacementProposal?.contractorName).toBe('North State Lines, Inc.');
    expect(n.replacementProposal?.addressLines).toEqual([
      '500 Linecoat Rd',
      'Anderson',
      'CA 96007',
    ]);
    expect(n.replacementProposal?.bidAmountUsd).toBe('$36,500.00');
  });

  it('carries through a custom signer (e.g. President)', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
      signer: YGE_COMPANY_INFO.president,
    });
    expect(n.closing.signer.name).toBe(YGE_COMPANY_INFO.president.name);
    expect(n.closing.signer.title).toBe('President');
  });

  it('carries through groundDetail verbatim (trimmed)', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
      groundDetail: '  Demand letter sent 04/30; no response by 05/15.  ',
    });
    expect(n.groundDetail).toBe('Demand letter sent 04/30; no response by 05/15.');
  });

  it('omits groundDetail when only whitespace is provided', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
      groundDetail: '   ',
    });
    expect(n.groundDetail).toBeUndefined();
  });

  it('falls back to "the Awarding Authority" when ownerAgency is missing', () => {
    const n = buildSubstitutionNotice(
      { projectName: 'Unnamed Job', ownerAgency: undefined, location: undefined },
      makeSub(),
      'PERFORM_FAILURE',
      { date: 'May 19, 2026' },
    );
    expect(n.addressee.agency).toBe('the Awarding Authority');
    expect(n.bodyParagraphs[0]).toContain('the Awarding Authority');
  });
});

describe('buildSubstitutionNotice — regression: pinned legal phrases', () => {
  it('cites §4107 in the subject line', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.subjectLine).toContain('§4107');
  });

  it('mentions §4107 in the boilerplate body so the agency clerk sees the statute', () => {
    const n = buildSubstitutionNotice(ESTIMATE, makeSub(), 'PERFORM_FAILURE', {
      date: 'May 19, 2026',
    });
    expect(n.bodyParagraphs.join(' ')).toContain('§4107');
  });

  it('starts every statute reference with "PCC §4107" so the cite stays canonical', () => {
    for (const g of listSubstitutionGrounds()) {
      expect(g.statuteRef.startsWith('PCC §4107')).toBe(true);
    }
  });
});
