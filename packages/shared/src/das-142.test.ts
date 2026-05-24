import { describe, it, expect } from 'vitest';
import { buildDas142, Das142InputSchema, type Das142Input } from './das-142';

const baseInput: Das142Input = Das142InputSchema.parse({
  contractorName: 'Young General Engineering, Inc.',
  contractorAddress: '19645 Little Woods Rd, Cottonwood CA 96022',
  contractorCslb: '1145219',
  contractorDir: '2000018967',
  projectName: 'Sulphur Springs Soquol Road',
  projectLocation: 'Mendocino County',
  craft: 'Operating Engineer',
  numberOfApprentices: 2,
  neededByDate: '2026-05-26', // Tuesday
  reportToAddress: 'Sulphur Springs Soquol Road jobsite, Mendocino County',
  reportToContact: 'Foreman Ryan Young — 707-599-9921',
  jatcName: 'OE Local 3 JATC — Region 4',
  jatcAddress: '1620 N Market Blvd, Sacramento CA 95834',
});

describe('buildDas142', () => {
  it('computes earliest 72-hour compliance date (3 business days back, holiday-aware)', () => {
    // Needed Tuesday 2026-05-26 → minus 3 business days.
    // Mon 2026-05-25 is Memorial Day so the countdown skips it:
    //   Tue 5/26 start → Fri 5/22 (1) → Thu 5/21 (2) → Wed 5/20 (3) → 2026-05-20.
    // Before bundle 2553 the local subtract72BusinessHours only skipped
    // weekends and returned 2026-05-21; this test pins the new
    // holiday-aware answer.
    const r = buildDas142(baseInput, '2026-05-22');
    expect(r.earliestComplianceDate).toBe('2026-05-20');
  });
  it('handles weekends in the 72-hour calculation', () => {
    // Needed Monday 2026-06-01 → minus 3 business days = Wednesday 2026-05-27.
    const r = buildDas142({ ...baseInput, neededByDate: '2026-06-01' }, '2026-05-22');
    expect(r.earliestComplianceDate).toBe('2026-05-27');
  });
  it('reports notice days given', () => {
    const r = buildDas142(baseInput, '2026-05-22');
    expect(r.noticeDaysGiven).toBe(4);
  });
  it('form text includes required regulatory reference', () => {
    const r = buildDas142(baseInput, '2026-05-22');
    expect(r.formText).toContain('DAS-142');
    expect(r.formText).toContain('8 CCR §230.1');
    expect(r.formText).toContain('Operating Engineer');
    expect(r.formText).toContain('2');
    expect(r.formText).toContain('OE Local 3 JATC');
  });
});
