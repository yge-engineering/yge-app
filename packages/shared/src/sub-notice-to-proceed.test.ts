import { describe, expect, it } from 'vitest';
import { buildSubNoticeToProceed } from './sub-notice-to-proceed';
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

describe('buildSubNoticeToProceed', () => {
  it('names the project + mobilization date in the body', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.subjectLine).toBe('Notice to Proceed — Sulphur Springs Soquol Road');
    expect(n.bodyParagraphs.join(' ')).toContain('June 2, 2026');
    expect(n.bodyParagraphs[0]).toContain('Sulphur Springs Soquol Road');
    expect(n.bodyParagraphs[0]).toContain('City of Cottonwood');
  });

  it('echoes the listed scope and bid amount', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.scopeBlock.portionOfWork).toBe('Striping and pavement markings');
    expect(n.scopeBlock.bidAmountUsd).toBe('$35,000.00');
  });

  it('parses the sub address into multi-line', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.addressee.addressLines).toEqual([
      '123 Industrial Way',
      'Redding',
      'CA 96002',
    ]);
  });

  it('defaults daily start time to 7 AM', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.mobilizationBlock.dailyStartTime).toBe('7:00 AM');
  });

  it('honors a custom daily start time', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
      dailyStartTime: '6:30 AM',
    });
    expect(n.mobilizationBlock.dailyStartTime).toBe('6:30 AM');
  });

  it('carries field contact + report-to address when supplied', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
      reportToAddress: 'Soquol Rd & Hwy 5 staging yard',
      fieldContact: {
        name: 'Tom Foreman',
        phone: '707-555-1212',
        title: 'YGE Field Superintendent',
      },
    });
    expect(n.mobilizationBlock.reportToAddress).toBe(
      'Soquol Rd & Hwy 5 staging yard',
    );
    expect(n.mobilizationBlock.fieldContact?.name).toBe('Tom Foreman');
    expect(n.mobilizationBlock.fieldContact?.title).toBe(
      'YGE Field Superintendent',
    );
  });

  it('keeps an empty list when no scope reminders supplied', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.scopeReminderBullets).toEqual([]);
  });

  it('filters blank reminder bullets', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
      scopeReminderBullets: ['Wear high-vis', '   ', 'Daily timecards via portal'],
    });
    expect(n.scopeReminderBullets).toEqual([
      'Wear high-vis',
      'Daily timecards via portal',
    ]);
  });

  it('signs as the VP by default and President when overridden', () => {
    const defaultN = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(defaultN.closing.signer.title).toBe('Vice President');
    const presidentN = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
      signer: YGE_COMPANY_INFO.president,
    });
    expect(presidentN.closing.signer.title).toBe('President');
  });
});

describe('buildSubNoticeToProceed — regression: pinned subject phrase', () => {
  it('keeps "Notice to Proceed" as the subject prefix', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.subjectLine.startsWith('Notice to Proceed')).toBe(true);
  });

  it('greets the sub by team name (so the letter does not start with bare "Dear,")', () => {
    const n = buildSubNoticeToProceed(ESTIMATE, makeSub(), {
      date: 'May 19, 2026',
      mobilizationStartDate: 'June 2, 2026',
    });
    expect(n.salutation.startsWith('Dear ')).toBe(true);
    expect(n.salutation.endsWith(' team,')).toBe(true);
  });
});
