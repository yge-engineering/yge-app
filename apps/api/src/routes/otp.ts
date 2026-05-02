// OTP routes — request + verify.
//
// Phase-1 dev mode skips real email sending; the plaintext code
// is logged to stderr AND returned in the response when env
// OTP_DEV_REVEAL=1. In production-like environments the code is
// only logged.
//
// The /verify endpoint never echoes the code back, only the
// outcome ('OK' / 'WRONG_CODE with N attempts left' / etc.).

import { Router } from 'express';
import { z } from 'zod';
import { OtpChallengeKindSchema } from '@yge/shared';
import { issueOtp, verifyOtp } from '../lib/otp-store';
import { logger } from '../lib/logger';

export const otpRouter = Router();

const RequestSchema = z.object({
  kind: OtpChallengeKindSchema,
  /** Opaque purpose tag — typically `sig:<signature-id>`. */
  purpose: z.string().min(1).max(120),
  /** Email address (kind=EMAIL) or E.164 phone (kind=SMS). */
  channelTarget: z.string().min(1).max(254),
});

otpRouter.post('/request', async (req, res, next) => {
  try {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const challenge = await issueOtp({
      kind: parsed.data.kind,
      purpose: parsed.data.purpose,
      channelTarget: parsed.data.channelTarget,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    // Phase 1 'send' — log to stderr. Real SMTP / Twilio
    // integration ships with the broader notifications layer.
    logger.info(
      { otpId: challenge.id, target: challenge.channelTarget, code: challenge.code },
      'OTP issued (phase-1 dev — no email/SMS sent)',
    );

    const reveal = process.env.OTP_DEV_REVEAL === '1';
    return res.status(201).json({
      challenge: {
        id: challenge.id,
        kind: challenge.kind,
        purpose: challenge.purpose,
        channelTarget: challenge.channelTarget,
        expiresAt: challenge.expiresAt,
        maxAttempts: challenge.maxAttempts,
      },
      // Dev reveal — production-like envs leave OTP_DEV_REVEAL unset,
      // in which case the field is omitted. The code is also in the
      // server log either way so devs can check stderr.
      ...(reveal ? { devCode: challenge.code } : {}),
    });
  } catch (err) { next(err); }
});

const VerifySchema = z.object({
  id: z.string().regex(/^otp-[a-z0-9]{8}$/),
  code: z.string().regex(/^\d{6}$/),
});

otpRouter.post('/verify', async (req, res, next) => {
  try {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { outcome, challenge } = await verifyOtp(parsed.data.id, parsed.data.code);
    if (!challenge) return res.status(404).json({ error: 'OTP challenge not found' });
    return res.json({
      outcome,
      // Surface a thin slice of the challenge state for the UI.
      challenge: {
        id: challenge.id,
        status: challenge.status,
        attemptCount: challenge.attemptCount,
        maxAttempts: challenge.maxAttempts,
        expiresAt: challenge.expiresAt,
        verifiedAt: challenge.verifiedAt,
      },
    });
  } catch (err) { next(err); }
});
