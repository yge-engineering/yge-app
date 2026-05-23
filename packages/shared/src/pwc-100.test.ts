import { describe, it, expect } from 'vitest';
import { buildPwc100, Pwc100InputSchema, type Pwc100Input } from './pwc-100';

const baseInput: Pwc100Input = Pwc100InputSchema.parse({
  awardingBodyName: 'CAL FIRE',
  primeContractorName: 'Young General Engineering, Inc.',
  primeContractorAddress: '19645 Little Woods Rd, Cottonwood CA 96022',
  primeContractorCslb: '1145219',
  primeContractorDir: '2000018967',
  projectName: 'Sulphur Springs Soquol Road',
  projectLocation: 'Mendocino County',
  projectDescription: 'Grading, drainage, base rock placement.',
  contractAmountCents: 125_000_000,
  awardDate: '2026-05-15',
});

describe('buildPwc100', () => {
  it('computes 5-day register-by deadline', () => {
    const r = buildPwc100(baseInput, '2026-05-22');
    expect(r.registerByDate).toBe('2026-05-20');
    expect(r.daysUntilDeadline).toBe(-2);
  });
  it('formats contract amount', () => {
    const r = buildPwc100(baseInput, '2026-05-22');
    expect(r.formText).toContain('$1,250,000.00');
  });
  it('includes regulatory reference + key parties', () => {
    const r = buildPwc100(baseInput, '2026-05-22');
    expect(r.formText).toContain('PWC-100');
    expect(r.formText).toContain('8 CCR §16451');
    expect(r.formText).toContain('CAL FIRE');
    expect(r.formText).toContain('1145219');
    expect(r.formText).toContain('2000018967');
    expect(r.formText).toContain('Sulphur Springs Soquol Road');
  });
  it('positive days when award is in the future', () => {
    const r = buildPwc100({ ...baseInput, awardDate: '2026-06-15' }, '2026-05-22');
    expect(r.daysUntilDeadline).toBeGreaterThan(0);
  });
});
