// Magic-link / OTP authentication challenge.
//
// Plain English: when a signer hits /sign/[id], the API issues a
// short-lived OTP code, sends it to their email (and/or SMS in
// future), and stores the challenge here. The signer types the
// code back in to prove control of the email; on success the
// signature row's auditContext.authMethod flips from 'IN_PERSON'
// to 'EMAIL_OTP' and authenticatedAt is set to the server's
// confirm timestamp.
//
// This is the attribution proof under ESIGN/UETA — the auditor
// doesn't take 'someone typed Ryan's name' on faith; the OTP +
// the timestamp + the signer's email control are the proof.
//
// Phase 1 ships the data model + the pure-data verify helper.
// The store + the route + the email send happen in subsequent
// commits.

import { z } from 'zod';

export const OtpChallengeKindSchema = z.enum([
  'EMAIL',
  'SMS', // future
]);
export type OtpChallengeKind = z.infer<typeof OtpChallengeKindSchema>;

export const OtpChallengeStatusSchema = z.enum([
  'PENDING',  // code issued, not yet verified
  'VERIFIED', // verified successfully
  'EXPIRED',  // TTL elapsed before verify
  'FAILED',   // attempts exhausted
  'VOIDED',   // operator cancelled
]);
export type OtpChallengeStatus = z.infer<typeof OtpChallengeStatusSchema>;

/** Server-side row. The plaintext `code` lives here only on the
 *  server; the client never sees it after issue. */
export const OtpChallengeSchema = z.object({
  /** Stable id of the form `otp-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  kind: OtpChallengeKindSchema,
  status: OtpChallengeStatusSchema.default('PENDING'),

  /** What the OTP is gating. The signature row's id when issued in
   *  the e-sign flow; future use cases (portal login, agent invite)
   *  use a different prefix. Keep the string opaque to the schema —
   *  the route layer is the policy boundary. */
  purpose: z.string().min(1).max(120),

  /** Address the code was sent to. Email format for kind=EMAIL,
   *  E.164 phone format for kind=SMS. */
  channelTarget: z.string().min(1).max(254),

  /** The code itself. Always 6 digits in Phase 1 — long enough to
   *  resist a guessing attack inside the TTL window, short enough
   *  to type from a phone screen. */
  code: z.string().regex(/^\d{6}$/),

  /** ISO timestamp at which the code stops being valid. Default
   *  TTL is 10 minutes from createdAt. */
  expiresAt: z.string(),

  /** How many wrong codes the signer has typed so far. */
  attemptCount: z.number().int().nonnegative().default(0),
  /** Hard cap. Once attemptCount === maxAttempts, status flips
   *  FAILED on the next verify. */
  maxAttempts: z.number().int().positive().default(5),

  /** Set when the row enters VERIFIED. Mirrors what lands on the
   *  signature row's auditContext.authenticatedAt. */
  verifiedAt: z.string().optional(),

  /** Optional context the route layer attaches at issue. */
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(500).optional(),
});
export type OtpChallenge = z.infer<typeof OtpChallengeSchema>;

export const OtpChallengeCreateSchema = OtpChallengeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OtpChallengeCreate = z.infer<typeof OtpChallengeCreateSchema>;

// ---- Helpers ------------------------------------------------------------

export function newOtpChallengeId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `otp-${hex.padStart(8, '0')}`;
}

/**
 * Generate a 6-digit OTP code as a string (preserves leading zeros).
 * Uses crypto.getRandomValues when available, falls back to
 * Math.random for environments that don't.
 */
export function generateOtpCode(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  let n: number;
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    g.crypto.getRandomValues(buf);
    n = buf[0]! % 1_000_000;
  } else {
    n = Math.floor(Math.random() * 1_000_000);
  }
  return n.toString().padStart(6, '0');
}

/** Default TTL — 10 minutes from now, ISO timestamp. */
export function defaultOtpExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
}

export type OtpVerifyOutcome =
  | { result: 'OK' }
  | { result: 'WRONG_CODE'; attemptsRemaining: number }
  | { result: 'EXPIRED' }
  | { result: 'EXHAUSTED' }
  | { result: 'NOT_PENDING'; status: OtpChallengeStatus };

/**
 * Pure verify — tells the caller what should happen next without
 * mutating anything. The caller persists the resulting status flip.
 */
export function evaluateOtpAttempt(
  challenge: OtpChallenge,
  submitted: string,
  now: Date = new Date(),
): OtpVerifyOutcome {
  if (challenge.status !== 'PENDING') {
    return { result: 'NOT_PENDING', status: challenge.status };
  }
  if (now.toISOString() > challenge.expiresAt) {
    return { result: 'EXPIRED' };
  }
  if (challenge.attemptCount >= challenge.maxAttempts) {
    return { result: 'EXHAUSTED' };
  }
  if (submitted === challenge.code) {
    return { result: 'OK' };
  }
  return {
    result: 'WRONG_CODE',
    attemptsRemaining: challenge.maxAttempts - challenge.attemptCount - 1,
  };
}

export interface OtpRollup {
  total: number;
  byStatus: Record<OtpChallengeStatus, number>;
  pendingCount: number;
}

export function computeOtpRollup(rows: OtpChallenge[]): OtpRollup {
  const byStatus: Record<OtpChallengeStatus, number> = {
    PENDING: 0, VERIFIED: 0, EXPIRED: 0, FAILED: 0, VOIDED: 0,
  };
  let pendingCount = 0;
  for (const r of rows) {
    byStatus[r.status] += 1;
    if (r.status === 'PENDING') pendingCount += 1;
  }
  return {
    total: rows.length,
    byStatus,
    pendingCount,
  };
}
