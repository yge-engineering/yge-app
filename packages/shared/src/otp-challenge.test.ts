import { describe, expect, it } from 'vitest';
import {
  OtpChallengeSchema,
  computeOtpRollup,
  defaultOtpExpiresAt,
  evaluateOtpAttempt,
  generateOtpCode,
  newOtpChallengeId,
  type OtpChallenge,
} from './otp-challenge';

function ch(over: Partial<OtpChallenge> = {}): OtpChallenge {
  return OtpChallengeSchema.parse({
    id: 'otp-aaaaaaaa',
    createdAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    kind: 'EMAIL',
    status: 'PENDING',
    purpose: 'sig:sig-aaaaaaaa',
    channelTarget: 'ryoung@youngge.com',
    code: '123456',
    expiresAt: '2026-04-01T12:10:00Z',
    attemptCount: 0,
    maxAttempts: 5,
    ...over,
  });
}

describe('id + code helpers', () => {
  it('newOtpChallengeId follows the pattern', () => {
    expect(newOtpChallengeId()).toMatch(/^otp-[0-9a-f]{8}$/);
  });
  it('generateOtpCode produces a 6-digit string', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
  it('defaultOtpExpiresAt is 10 minutes ahead', () => {
    const now = new Date('2026-04-01T12:00:00Z');
    expect(defaultOtpExpiresAt(now)).toBe('2026-04-01T12:10:00.000Z');
  });
});

describe('OtpChallengeSchema', () => {
  it('rejects a non-6-digit code', () => {
    expect(() => ch({ code: '12345' })).toThrow();
    expect(() => ch({ code: '123A56' })).toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() =>
      OtpChallengeSchema.parse({
        ...ch(),
        kind: 'TELEGRAM',
      }),
    ).toThrow();
  });
});

describe('evaluateOtpAttempt', () => {
  const now = new Date('2026-04-01T12:05:00Z');

  it('returns OK on a matching code in window', () => {
    expect(evaluateOtpAttempt(ch(), '123456', now)).toEqual({ result: 'OK' });
  });

  it('returns WRONG_CODE with attemptsRemaining on mismatch', () => {
    expect(evaluateOtpAttempt(ch({ attemptCount: 1 }), '999999', now)).toEqual({
      result: 'WRONG_CODE',
      attemptsRemaining: 3,
    });
  });

  it('returns EXPIRED when past expiresAt', () => {
    const past = new Date('2026-04-01T12:11:00Z');
    expect(evaluateOtpAttempt(ch(), '123456', past)).toEqual({ result: 'EXPIRED' });
  });

  it('returns EXHAUSTED when attemptCount >= maxAttempts', () => {
    expect(
      evaluateOtpAttempt(ch({ attemptCount: 5, maxAttempts: 5 }), '123456', now),
    ).toEqual({ result: 'EXHAUSTED' });
  });

  it('returns NOT_PENDING for already-decided challenges', () => {
    expect(evaluateOtpAttempt(ch({ status: 'VERIFIED' }), '123456', now)).toEqual({
      result: 'NOT_PENDING',
      status: 'VERIFIED',
    });
  });
});

describe('computeOtpRollup', () => {
  it('counts by status + pending', () => {
    const rows: OtpChallenge[] = [
      ch({ id: 'otp-1', status: 'PENDING' }),
      ch({ id: 'otp-2', status: 'PENDING' }),
      ch({ id: 'otp-3', status: 'VERIFIED' }),
      ch({ id: 'otp-4', status: 'EXPIRED' }),
    ];
    const r = computeOtpRollup(rows);
    expect(r.total).toBe(4);
    expect(r.pendingCount).toBe(2);
    expect(r.byStatus.PENDING).toBe(2);
    expect(r.byStatus.VERIFIED).toBe(1);
    expect(r.byStatus.EXPIRED).toBe(1);
  });
});
