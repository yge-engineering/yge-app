import { describe, it, expect } from 'vitest';
import { buildDas140, Das140InputSchema, type Das140Input } from './das-140';

const baseInput: Das140Input = Das140InputSchema.parse({
  awardingBodyName: 'CAL FIRE',
  contractorName: 'Young General Engineering, Inc.',
  contractorAddress: '19645 Little Woods Rd, Cottonwood CA 96022',
  contractorCslb: '1145219',
  contractorDir: '2000018967',
  projectName: 'Sulphur Springs Soquol Road',
  projectLocation: 'Soquol Road, Mendocino County',
  contractAmountCents: 125_000_000,
  awardDate: '2026-05-15',
  craft: 'Operating Engineer',
  jatcName: 'OE Local 3 JATC — Region 4',
  jatcAddress: '1620 N Market Blvd, Sacramento CA 95834',
});

describe('buildDas140', () => {
  it('computes 10-day notify-by deadline', () => {
    const r = buildDas140(baseInput, '2026-05-22');
    expect(r.notifyByDate).toBe('2026-05-25');
    expect(r.daysUntilDeadline).toBe(3);
  });
  it('flags past deadline with negative days', () => {
    const r = buildDas140(baseInput, '2026-06-01');
    expect(r.daysUntilDeadline).toBeLessThan(0);
  });
  it('form text includes required regulatory references', () => {
    const r = buildDas140(baseInput, '2026-05-22');
    expect(r.formText).toContain('DAS-140');
    expect(r.formText).toContain('8 CCR §230');
    expect(r.formText).toContain('CSLB License:  1145219');
    expect(r.formText).toContain('DIR PWC Reg #: 2000018967');
    expect(r.formText).toContain('CAL FIRE');
    expect(r.formText).toContain('Operating Engineer');
    expect(r.formText).toContain('Sulphur Springs Soquol Road');
    expect(r.formText).toContain('OE Local 3 JATC');
  });
  it('formats contract amount as USD', () => {
    const r = buildDas140(baseInput, '2026-05-22');
    expect(r.formText).toContain('$1,250,000.00');
  });
  it('renders (unknown) when estimated hours are missing', () => {
    const minimal = Das140InputSchema.parse({
      awardingBodyName: 'County of X',
      contractorName: 'YGE',
      contractorAddress: 'addr',
      contractorCslb: 'xxx',
      contractorDir: 'yyy',
      projectName: 'P',
      projectLocation: 'L',
      contractAmountCents: 100_000,
      awardDate: '2026-01-01',
      craft: 'Laborer',
      jatcName: 'JATC',
      jatcAddress: 'JATC addr',
    });
    const r = buildDas140(minimal, '2026-01-05');
    expect(r.formText).toContain('Estimated journey-level hours: (unknown)');
    expect(r.formText).toContain('Estimated apprentice hours:    (unknown)');
  });
});
