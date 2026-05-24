// Coverage for the AR collection sequence engine.
//
// Pin the cadence so a thresholds tweak shows up as a deliberate
// behavior change (failing test) rather than a silent drift in
// Brook's Monday-morning collections meeting.

import { describe, it, expect } from 'vitest';
import {
  recommendArAction,
  rankArCollections,
  DEFAULT_AR_THRESHOLDS,
} from './ar-collection-sequence';

describe('recommendArAction', () => {
  it('returns NONE when not yet past due', () => {
    const r = recommendArAction({ amountCents: 250_000, ageDays: 0 });
    expect(r.action).toBe('NONE');
    expect(r.urgency).toBe(1);
  });

  it('returns NONE within the courtesy window (< 30 days)', () => {
    const r = recommendArAction({ amountCents: 250_000, ageDays: 28 });
    expect(r.action).toBe('NONE');
  });

  it('30 days → COURTESY_CALL at urgency 2', () => {
    const r = recommendArAction({ amountCents: 250_000, ageDays: 32 });
    expect(r.action).toBe('COURTESY_CALL');
    expect(r.urgency).toBe(2);
  });

  it('30 days + big balance → COURTESY_CALL at urgency 3', () => {
    // ≥ $10,000 bumps the urgency.
    const r = recommendArAction({ amountCents: 1_500_000, ageDays: 32 });
    expect(r.action).toBe('COURTESY_CALL');
    expect(r.urgency).toBe(3);
  });

  it('45 days → EMAIL_REMINDER', () => {
    const r = recommendArAction({ amountCents: 250_000, ageDays: 46 });
    expect(r.action).toBe('EMAIL_REMINDER');
    expect(r.urgency).toBe(3);
  });

  it('60 days without a preliminary notice → PRELIMINARY_LIEN_NOTICE high urgency', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 62,
      preliminaryNoticeServed: false,
    });
    expect(r.action).toBe('PRELIMINARY_LIEN_NOTICE');
    expect(r.urgency).toBe(5);
  });

  it('60 days WITH a preliminary notice falls through to EMAIL_REMINDER tier', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 62,
      preliminaryNoticeServed: true,
    });
    // Above email-reminder threshold, below demand-letter threshold.
    expect(r.action).toBe('EMAIL_REMINDER');
  });

  it('90 days → DEMAND_LETTER', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 95,
      preliminaryNoticeServed: true,
    });
    expect(r.action).toBe('DEMAND_LETTER');
    expect(r.urgency).toBe(4);
  });

  it('90 days but demand letter already sent → falls back', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 95,
      preliminaryNoticeServed: true,
      demandLetterSent: true,
    });
    // Should NOT recommend DEMAND_LETTER again — falls to EMAIL_REMINDER.
    expect(r.action).toBe('EMAIL_REMINDER');
  });

  it('100 days on public works → STOP_PAYMENT_NOTICE', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 105,
      preliminaryNoticeServed: true,
      demandLetterSent: true,
      publicWorks: true,
    });
    expect(r.action).toBe('STOP_PAYMENT_NOTICE');
    expect(r.urgency).toBe(5);
  });

  it('100 days on PRIVATE works does NOT recommend stop-payment (wrong remedy)', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 105,
      preliminaryNoticeServed: true,
      demandLetterSent: true,
      publicWorks: false,
    });
    // Stop-payment is CA §9350 (public only). Private jobs use
    // mechanic's lien which is its own workflow — this engine doesn't
    // recommend it; it just doesn't recommend STOP_PAYMENT_NOTICE here.
    // Falls through to legal escalation threshold instead.
    expect(r.action).not.toBe('STOP_PAYMENT_NOTICE');
  });

  it('120 days → LEGAL_ESCALATION trumps everything', () => {
    const r = recommendArAction({
      amountCents: 500_000,
      ageDays: 125,
      preliminaryNoticeServed: false,
      publicWorks: true,
    });
    expect(r.action).toBe('LEGAL_ESCALATION');
    expect(r.urgency).toBe(5);
  });

  it('respects custom thresholds', () => {
    // Tighter cadence: courtesy call at 21, email at 30.
    const r = recommendArAction(
      { amountCents: 250_000, ageDays: 25 },
      { ...DEFAULT_AR_THRESHOLDS, courtesyCallAt: 21, emailReminderAt: 30 },
    );
    expect(r.action).toBe('COURTESY_CALL');
  });
});

describe('rankArCollections', () => {
  it('sorts by urgency desc, then amount desc', () => {
    const ranked = rankArCollections([
      { amountCents: 100_000, ageDays: 10 },         // NONE urgency 1
      { amountCents: 200_000, ageDays: 35 },         // COURTESY urgency 2
      { amountCents: 5_000_000, ageDays: 95, preliminaryNoticeServed: true }, // DEMAND urgency 4
      { amountCents: 1_500_000, ageDays: 35 },       // COURTESY urgency 3 ($15k bump)
    ]);
    const actions = ranked.map((r) => r.rec.action);
    expect(actions[0]).toBe('DEMAND_LETTER');
    expect(actions[1]).toBe('COURTESY_CALL'); // the $15k one, urgency 3
    expect(actions[2]).toBe('COURTESY_CALL'); // the $2k one, urgency 2
    expect(actions[3]).toBe('NONE');
  });
});
