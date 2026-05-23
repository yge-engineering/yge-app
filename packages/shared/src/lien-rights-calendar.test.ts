import { describe, it, expect } from 'vitest';
import {
  computeLienDeadlines,
  summarizeLienCalendar,
  LienRightsInputSchema,
  type LienRightsInput,
} from './lien-rights-calendar';

function base(over: Partial<LienRightsInput> = {}): LienRightsInput {
  return LienRightsInputSchema.parse({
    jobId: 'job-1',
    jobName: 'Sulphur Springs',
    jobType: 'PUBLIC',
    isSubTier: true,
    prelimNoticeServed: false,
    ...over,
  });
}

describe('computeLienDeadlines — preliminary 20-day', () => {
  it('PENDING when first work was 10 days ago', () => {
    const today = '2026-05-22';
    const firstWorkDate = '2026-05-12'; // 10 days ago, due 2026-06-01
    const ds = computeLienDeadlines(base({ firstWorkDate }), today);
    const p = ds.find((d) => d.type === 'PRELIMINARY_20_DAY');
    expect(p?.dueDate).toBe('2026-06-01');
    expect(p?.status).toBe('PENDING');
    expect(p?.daysUntilDue).toBe(10);
  });

  it('PAST_DUE when first work was 30 days ago and notice not served', () => {
    const today = '2026-05-22';
    const firstWorkDate = '2026-04-22'; // due 2026-05-12, 10 days past
    const ds = computeLienDeadlines(base({ firstWorkDate }), today);
    const p = ds.find((d) => d.type === 'PRELIMINARY_20_DAY');
    expect(p?.status).toBe('PAST_DUE');
    expect(p?.daysUntilDue).toBe(-10);
  });

  it('COMPLETED when prelimNoticeServed is true', () => {
    const ds = computeLienDeadlines(
      base({ firstWorkDate: '2026-04-22', prelimNoticeServed: true }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'PRELIMINARY_20_DAY');
    expect(p?.status).toBe('COMPLETED');
  });
});

describe('computeLienDeadlines — 90-day mechanics lien', () => {
  it('PENDING within 90 days of last work', () => {
    const ds = computeLienDeadlines(
      base({ lastWorkDate: '2026-04-01' }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'MECHANICS_LIEN_90_DAY');
    expect(p?.dueDate).toBe('2026-06-30');
    expect(p?.status).toBe('PENDING');
  });

  it('PAST_DUE past 90 days', () => {
    const ds = computeLienDeadlines(
      base({ lastWorkDate: '2026-01-01' }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'MECHANICS_LIEN_90_DAY');
    expect(p?.status).toBe('PAST_DUE');
  });

  it('COMPLETED when lienRecordedDate set', () => {
    const ds = computeLienDeadlines(
      base({ lastWorkDate: '2026-04-01', lienRecordedDate: '2026-05-15' }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'MECHANICS_LIEN_90_DAY');
    expect(p?.status).toBe('COMPLETED');
  });
});

describe('computeLienDeadlines — post-NOC window', () => {
  it('30 days for sub-tier (default)', () => {
    const ds = computeLienDeadlines(
      base({ ncDate: '2026-05-01' }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'MECHANICS_LIEN_POST_NOC');
    expect(p?.dueDate).toBe('2026-05-31');
    expect(p?.description).toContain('sub-tier');
  });

  it('60 days for direct contractor', () => {
    const ds = computeLienDeadlines(
      base({ ncDate: '2026-05-01', isSubTier: false }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'MECHANICS_LIEN_POST_NOC');
    expect(p?.dueDate).toBe('2026-06-30');
    expect(p?.description).toContain('direct contractor');
  });
});

describe('computeLienDeadlines — retention release', () => {
  it('included for PUBLIC jobs only', () => {
    const ds = computeLienDeadlines(
      base({ jobType: 'PUBLIC', lastWorkDate: '2026-04-01' }),
      '2026-05-22',
    );
    expect(ds.some((d) => d.type === 'RETENTION_RELEASE_60_DAY')).toBe(true);
    const dsPriv = computeLienDeadlines(
      base({ jobType: 'PRIVATE', lastWorkDate: '2026-04-01' }),
      '2026-05-22',
    );
    expect(dsPriv.some((d) => d.type === 'RETENTION_RELEASE_60_DAY')).toBe(false);
  });

  it('60-day clock fires PAST_DUE correctly', () => {
    const ds = computeLienDeadlines(
      base({ jobType: 'PUBLIC', lastWorkDate: '2026-01-01' }),
      '2026-05-22',
    );
    const p = ds.find((d) => d.type === 'RETENTION_RELEASE_60_DAY');
    expect(p?.status).toBe('PAST_DUE');
  });
});

describe('sort order', () => {
  it('PAST_DUE first, then PENDING by soonest, then COMPLETED', () => {
    const ds = computeLienDeadlines(
      base({
        firstWorkDate: '2026-04-22', // past-due prelim
        lastWorkDate: '2026-05-01',  // pending 90-day
        ncDate: '2026-05-20',         // pending 30-day post-NOC
      }),
      '2026-05-22',
    );
    expect(ds[0]?.status).toBe('PAST_DUE');
    expect(ds[1]?.status).toBe('PENDING');
  });
});

describe('summarizeLienCalendar', () => {
  it('counts past-due, due-within-30, completed and jobs-with-past-due', () => {
    const ds = computeLienDeadlines(
      base({
        firstWorkDate: '2026-04-22',
        lastWorkDate: '2026-05-15',
        ncDate: '2026-05-15',
      }),
      '2026-05-22',
    );
    const sum = summarizeLienCalendar(ds);
    expect(sum.totalDeadlines).toBe(ds.length);
    expect(sum.pastDue).toBeGreaterThan(0);
    expect(sum.jobsWithPastDue).toBe(1);
  });
});
