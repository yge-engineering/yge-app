import { describe, expect, it } from 'vitest';
import { buildSubAwardNotice } from './sub-award-notice';
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

describe('buildSubAwardNotice', () => {
  it('addresses the sub by contractor name and parses the address into lines', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.addressee.contractorName).toBe('Acme Striping LLC');
    expect(n.addressee.addressLines).toEqual([
      '123 Industrial Way',
      'Redding',
      'CA 96002',
    ]);
    expect(n.addressee.cslbLicense).toBe('999999');
    expect(n.addressee.dirRegistration).toBe('1000000111');
  });

  it('builds a subject line + salutation that name the project and the sub', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.subjectLine).toBe(
      'Notice of Subcontract Award — Sulphur Springs Soquol Road',
    );
    expect(n.salutation).toBe('Dear Acme Striping LLC team,');
  });

  it('names the agency and the prime in the first body paragraph', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    const opener = n.bodyParagraphs[0];
    expect(opener).toBeDefined();
    expect(opener).toContain('City of Cottonwood');
    expect(opener).toContain('Young General Engineering, Inc.');
    expect(opener).toContain('Sulphur Springs Soquol Road');
  });

  it('formats the scope block with the listed portion of work + bid amount', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.scopeBlock.portionOfWork).toBe('Striping and pavement markings');
    expect(n.scopeBlock.bidAmountUsd).toBe('$35,000.00');
  });

  it('lists the four next-steps items by default', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.nextSteps).toHaveLength(4);
    expect(n.nextSteps[3]).toContain('10 business days');
  });

  it('honors a custom response window', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), {
      date: 'May 18, 2026',
      responseWindowBusinessDays: 5,
    });
    expect(n.nextSteps[3]).toContain('5 business days');
    expect(n.closingParagraph).toContain("5 business days");
  });

  it('uses the VP as the default signer', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.closing.signer.name).toBe(YGE_COMPANY_INFO.vicePresident.name);
    expect(n.closing.signer.title).toBe('Vice President');
  });

  it('supports the President as an alternate signer', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), {
      date: 'May 18, 2026',
      signer: YGE_COMPANY_INFO.president,
    });
    expect(n.closing.signer.name).toBe(YGE_COMPANY_INFO.president.name);
    expect(n.closing.signer.title).toBe('President');
  });

  it('gracefully omits address lines when the sub has no address', () => {
    const n = buildSubAwardNotice(
      ESTIMATE,
      makeSub({ address: undefined }),
      { date: 'May 18, 2026' },
    );
    expect(n.addressee.addressLines).toEqual([]);
  });

  it('falls back to a generic agency phrase when ownerAgency is missing', () => {
    const n = buildSubAwardNotice(
      { projectName: 'Generic Job', ownerAgency: undefined, location: undefined },
      makeSub(),
      { date: 'May 18, 2026' },
    );
    expect(n.bodyParagraphs[0]).toContain('the awarding agency');
  });

  it('builds a countersignature prompt naming the sub', () => {
    const n = buildSubAwardNotice(ESTIMATE, makeSub(), { date: 'May 18, 2026' });
    expect(n.countersignaturePrompt).toBe(
      'Accepted and agreed on behalf of Acme Striping LLC:',
    );
  });
});
