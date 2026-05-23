import { describe, it, expect } from 'vitest';
import {
  buildStopPaymentNotice,
  StopPaymentInputSchema,
  type StopPaymentInput,
} from './stop-payment-notice';

const baseInput: StopPaymentInput = StopPaymentInputSchema.parse({
  claimantName: 'Young General Engineering, Inc.',
  claimantAddress: '19645 Little Woods Rd, Cottonwood CA 96022',
  hiringPartyName: 'BigPrime Construction LLC',
  primeContractorName: 'BigPrime Construction LLC',
  publicAgencyName: 'CAL FIRE',
  projectName: 'Sulphur Springs Soquol Road',
  workDescription: 'Grading, drainage culvert installation, and base rock placement.',
  amountClaimedCents: 1_234_567,
  lastWorkDate: '2026-04-01',
});

describe('buildStopPaymentNotice', () => {
  it('computes 90-day serve-by date from last work', () => {
    const r = buildStopPaymentNotice(baseInput, '2026-05-22');
    expect(r.serveByDate).toBe('2026-06-30');
  });
  it('returns negative daysUntilDeadline when past', () => {
    const r = buildStopPaymentNotice(baseInput, '2026-08-01');
    expect(r.daysUntilDeadline).toBeLessThan(0);
  });
  it('computes 125% withhold', () => {
    const r = buildStopPaymentNotice(baseInput, '2026-05-22');
    expect(r.withholdAmountCents).toBe(Math.round(1_234_567 * 1.25));
  });
  it('notice text includes the required CA statutory references', () => {
    const r = buildStopPaymentNotice(baseInput, '2026-05-22');
    expect(r.noticeText).toContain('STOP-PAYMENT NOTICE');
    expect(r.noticeText).toContain('§§9350');
    expect(r.noticeText).toContain('§9358');
    expect(r.noticeText).toContain('125%');
    expect(r.noticeText).toContain('CAL FIRE');
    expect(r.noticeText).toContain('Sulphur Springs Soquol Road');
    expect(r.noticeText).toContain('Young General Engineering, Inc.');
  });
  it('formats dollars as USD', () => {
    const r = buildStopPaymentNotice(baseInput, '2026-05-22');
    expect(r.noticeText).toContain('$12,345.67');
    expect(r.noticeText).toContain('$15,432.09'); // 125%
  });
});
