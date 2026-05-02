// File-based store for OTP challenges.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. Failed
// verify attempts are particularly important to log because they
// signal a potential brute-force; the audit panel for a Signature
// row should show every wrong code typed against its OTP.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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

function dataDir(): string {
  return (
    process.env.OTP_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'otp-challenges')
  );
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<OtpChallenge[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = OtpChallengeSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((c): c is OtpChallenge => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: OtpChallenge[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(c: OtpChallenge) {
  await ensureDir();
  await fs.writeFile(rowPath(c.id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  const at = index.findIndex((row) => row.id === c.id);
  if (at >= 0) index[at] = c;
  else index.unshift(c);
  await writeIndex(index);
}

export interface IssueOtpInput {
  kind: OtpChallengeKind;
  purpose: string;
  channelTarget: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Issue a fresh OTP challenge. The plaintext code is included in
 * the return so the route layer can hand it to the email / SMS
 * sender. After this call, the code is on disk inside the row but
 * NEVER returned to the verifying client (the verify endpoint just
 * reports OK / WRONG_CODE / etc., never the code).
 */
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
    entityType: 'Signature', // OTPs gate signing today; future portal-login
                              // OTPs would tag against User instead
    entityId: c.id,
    // Don't record the plaintext code in the audit row.
    after: { ...c, code: '<redacted>' },
    ctx,
  });
  return c;
}

export async function getOtp(id: string): Promise<OtpChallenge | null> {
  if (!/^otp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return OtpChallengeSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function listOtpsForPurpose(purpose: string): Promise<OtpChallenge[]> {
  const all = await readIndex();
  return all.filter((c) => c.purpose === purpose);
}

/**
 * Verify a submitted code against a challenge. Mutates the
 * challenge row's status / attemptCount / verifiedAt as needed
 * and returns the outcome.
 */
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
      // Redact code in before/after snapshots.
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
