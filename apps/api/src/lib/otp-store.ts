// Postgres-backed store for OTP challenges.
//
// Plaintext code lives in the Json `data` blob; we never return it
// from the verify endpoint (only OK / WRONG_CODE / EXPIRED outcomes).

import { prisma } from '@yge/db';
import {
  OtpChallengeSchema,
  defaultOtpExpiresAt,
  evaluateOtpAttempt,
  generateOtpCode,
  newOtpChallengeId,
  type OtpChallenge,
  type OtpChallengeKind,
  type OtpVerifyOutcome,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function row2otp(row: { data: unknown }): OtpChallenge | null {
  const r = OtpChallengeSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

async function persist(c: OtpChallenge): Promise<void> {
  await prisma.otpRequest.upsert({
    where: { id: c.id },
    create: {
      id: c.id,
      email: c.channelTarget,
      expiresAt: new Date(c.expiresAt),
      data: c as unknown as object,
    },
    update: {
      email: c.channelTarget,
      expiresAt: new Date(c.expiresAt),
      data: c as unknown as object,
    },
  });
}

export interface IssueOtpInput {
  kind: OtpChallengeKind;
  purpose: string;
  channelTarget: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function issueOtp(input: IssueOtpInput, ctx?: AuditContext): Promise<OtpChallenge> {
  const now = new Date();
  const id = newOtpChallengeId();
  const code = generateOtpCode();
  const c: OtpChallenge = OtpChallengeSchema.parse({
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    kind: input.kind,
    status: 'PENDING',
    purpose: input.purpose,
    channelTarget: input.channelTarget,
    code,
    expiresAt: defaultOtpExpiresAt(now),
    attemptCount: 0,
    maxAttempts: 5,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await persist(c);
  await recordAudit({
    action: 'create',
    entityType: 'Signature',
    entityId: c.id,
    after: { ...c, code: '<redacted>' },
    ctx,
  });
  return c;
}

export async function getOtp(id: string): Promise<OtpChallenge | null> {
  if (!/^otp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.otpRequest.findFirst({ where: { id } });
  if (!row) return null;
  return row2otp(row);
}

export async function listOtpsForPurpose(purpose: string): Promise<OtpChallenge[]> {
  const rows = await prisma.otpRequest.findMany({});
  return rows
    .map(row2otp)
    .filter((c): c is OtpChallenge => c !== null)
    .filter((c) => c.purpose === purpose);
}

export async function verifyOtp(
  id: string,
  submitted: string,
  ctx?: AuditContext,
): Promise<{ outcome: OtpVerifyOutcome; challenge: OtpChallenge | null }> {
  const existing = await getOtp(id);
  if (!existing) return { outcome: { result: 'NOT_PENDING', status: 'EXPIRED' }, challenge: null };

  const now = new Date();
  const outcome = evaluateOtpAttempt(existing, submitted, now);

  let updated: OtpChallenge = existing;
  if (outcome.result === 'OK') {
    updated = OtpChallengeSchema.parse({
      ...existing,
      status: 'VERIFIED',
      verifiedAt: now.toISOString(),
      attemptCount: existing.attemptCount + 1,
      updatedAt: now.toISOString(),
    });
  } else if (outcome.result === 'WRONG_CODE') {
    const newCount = existing.attemptCount + 1;
    const exhausted = newCount >= existing.maxAttempts;
    updated = OtpChallengeSchema.parse({
      ...existing,
      attemptCount: newCount,
      status: exhausted ? 'FAILED' : 'PENDING',
      updatedAt: now.toISOString(),
    });
  } else if (outcome.result === 'EXPIRED' && existing.status !== 'EXPIRED') {
    updated = OtpChallengeSchema.parse({
      ...existing,
      status: 'EXPIRED',
      updatedAt: now.toISOString(),
    });
  } else if (outcome.result === 'EXHAUSTED' && existing.status !== 'FAILED') {
    updated = OtpChallengeSchema.parse({
      ...existing,
      status: 'FAILED',
      updatedAt: now.toISOString(),
    });
  }

  if (updated !== existing) {
    await persist(updated);
    const action =
      outcome.result === 'OK'
        ? 'approve'
        : outcome.result === 'WRONG_CODE'
          ? 'reject'
          : 'update';
    await recordAudit({
      action,
      entityType: 'Signature',
      entityId: id,
      before: { ...existing, code: '<redacted>' },
      after: { ...updated, code: '<redacted>' },
      ctx: {
        ...ctx,
        reason:
          outcome.result === 'WRONG_CODE'
            ? `Wrong code; ${outcome.attemptsRemaining} attempt${outcome.attemptsRemaining === 1 ? '' : 's'} remaining`
            : ctx?.reason,
      },
    });
  }

  return { outcome, challenge: updated };
}
