// Coverage for bid-doc filename classifier.

import { describe, it, expect } from 'vitest';
import { classifyBidDoc, classifyBidDocs } from './bid-doc-classify';

describe('classifyBidDoc', () => {
  it('identifies Caltrans plan set', () => {
    const r = classifyBidDoc('03-1K2904_Project_Plans.pdf');
    expect(r.kind).toBe('PLAN_SET');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('identifies special provisions as SPECIFICATIONS', () => {
    const r = classifyBidDoc('03-1K2904_Special_Provisions.pdf');
    expect(r.kind).toBe('SPECIFICATIONS');
  });

  it('identifies bid item schedule', () => {
    const r = classifyBidDoc('Bid_Item_Schedule.xlsx');
    expect(r.kind).toBe('BID_SCHEDULE');
  });

  it('identifies addendum', () => {
    const r = classifyBidDoc('Addendum No 2.pdf');
    expect(r.kind).toBe('ADDENDUM');
  });

  it('identifies geotech', () => {
    const r = classifyBidDoc('Geotechnical_Report_Final.pdf');
    expect(r.kind).toBe('GEOTECH_REPORT');
  });

  it('identifies engineers estimate', () => {
    const r = classifyBidDoc("Engineers_Estimate.pdf");
    expect(r.kind).toBe('ENGINEERS_ESTIMATE');
  });

  it('identifies Q&A log', () => {
    const r = classifyBidDoc('Q_and_A_Log_through_5_22_2026.pdf');
    expect(r.kind).toBe('QA_LOG');
  });

  it('weak-match falls below strong-match confidence', () => {
    const weak = classifyBidDoc('plans.pdf');
    const strong = classifyBidDoc('Project_Plans.pdf');
    expect(weak.kind).toBe('PLAN_SET');
    expect(strong.kind).toBe('PLAN_SET');
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });

  it('returns OTHER + zero confidence for an unknown name', () => {
    const r = classifyBidDoc('Random_File.jpg');
    expect(r.kind).toBe('OTHER');
    expect(r.confidence).toBe(0);
  });
});

describe('classifyBidDocs', () => {
  it('buckets a typical Caltrans packet', () => {
    const { byKind } = classifyBidDocs([
      '03-1K2904_Project_Plans.pdf',
      '03-1K2904_Special_Provisions.pdf',
      'Bid_Item_Schedule.xlsx',
      'Addendum_No_2.pdf',
      'Geotechnical_Report.pdf',
      'Engineers_Estimate.pdf',
      'Q_and_A_Log.pdf',
      'Cover_Letter.pdf',
    ]);
    expect(byKind.get('PLAN_SET')?.length).toBe(1);
    expect(byKind.get('SPECIFICATIONS')?.length).toBe(1);
    expect(byKind.get('BID_SCHEDULE')?.length).toBe(1);
    expect(byKind.get('ADDENDUM')?.length).toBe(1);
    expect(byKind.get('GEOTECH_REPORT')?.length).toBe(1);
    expect(byKind.get('ENGINEERS_ESTIMATE')?.length).toBe(1);
    expect(byKind.get('QA_LOG')?.length).toBe(1);
    expect(byKind.get('COVER_LETTER')?.length).toBe(1);
  });
});
