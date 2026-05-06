// WebAuthn (Face ID / Touch ID / Windows Hello) endpoints.
//
// Plain English: a "passkey" is a public key your device generates and
// stores in a secure enclave. To register, the browser asks the OS for
// a new key and sends us the public half. To sign in, we ask the OS to
// sign a random challenge with the private half — only the rightful
// device can do it, and only after Face ID / fingerprint / PIN.
//
// Four endpoints, two ceremonies:
//
//   POST /register/options   → start register, returns challenge + opts
//   POST /register/verify    → finish register, stores the public key
//   POST /auth/options       → start sign-in, returns challenge
//   POST /auth/verify        → finish sign-in, returns email on success
//
// The web app drives the browser navigator.credentials calls and proxies
// to these endpoints. Session cookies are set on the web origin from the
// returned email.

import { Router } from 'express';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  bumpCredentialCounter,
  consumeChallenge,
  findCredentialById,
  listCredentials,
  saveChallenge,
  saveCredential,
} from '../lib/webauthn-store';
import { getPortalUserByEmail } from '../lib/portal-users-store';

export const webauthnRouter = Router();

/**
 * Relying-party config. In prod set WEBAUTHN_RP_ID to the apex domain
 * the user signs in at (e.g. `app.youngge.com`). For local dev we fall
 * back to `localhost`. The expectedOrigin used during verification is
 * derived from the request's Origin header so the same code serves
 * both prod and dev without a redeploy.
 */
function rpConfig() {
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'YGE Estimating',
  };
}

function expectedOriginsFor(reqOrigin: string | undefined): string[] {
  const env = process.env.WEBAUTHN_ORIGIN;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean);
  // Default allow-list: the Origin the browser sent (best effort) plus
  // the common dev ports. Production deployments should set
  // WEBAUTHN_ORIGIN explicitly to lock this down.
  const defaults = ['http://localhost:3000', 'http://localhost:3001'];
  if (reqOrigin && !defaults.includes(reqOrigin)) defaults.push(reqOrigin);
  return defaults;
}

// ---- Register: options --------------------------------------------------

const RegisterOptionsBody = z.object({
  email: z.string().email(),
  nickname: z.string().max(100).optional(),
});

webauthnRouter.post('/register/options', async (req, res, next) => {
  try {
    const parsed = RegisterOptionsBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await getPortalUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Email not on access list' });

    const { rpID, rpName } = rpConfig();
    const existing = await listCredentials(email);
    const opts = await generateRegistrationOptions({
      rpID,
      rpName,
      userName: email,
      userDisplayName: user.name ?? email,
      attestationType: 'none',
      // Skip credentials they've already registered so the browser
      // doesn't quietly succeed without prompting.
      excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    await saveChallenge({
      email,
      challenge: opts.challenge,
      purpose: 'register',
      createdAt: Date.now(),
    });
    return res.json(opts);
  } catch (err) {
    next(err);
  }
});

// ---- Register: verify ---------------------------------------------------

const RegisterVerifyBody = z.object({
  email: z.string().email(),
  nickname: z.string().max(100).optional(),
  // Loose schema — simplewebauthn validates the inner shape itself.
  response: z.unknown(),
});

webauthnRouter.post('/register/verify', async (req, res, next) => {
  try {
    const parsed = RegisterVerifyBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await getPortalUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Email not on access list' });

    const expectedChallenge = await consumeChallenge(email, 'register');
    if (!expectedChallenge) {
      return res
        .status(400)
        .json({ error: 'No active registration challenge — start over.' });
    }

    const { rpID } = rpConfig();
    const verification = await verifyRegistrationResponse({
      // simplewebauthn types the response as RegistrationResponseJSON; we
      // pass it through as `unknown` since the validation lives there.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: parsed.data.response as any,
      expectedChallenge,
      expectedOrigin: expectedOriginsFor(req.get('origin') ?? undefined),
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration not verified' });
    }
    const info = verification.registrationInfo;

    await saveCredential({
      email,
      credentialId: info.credential.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      counter: info.credential.counter,
      transports: info.credential.transports,
      ...(parsed.data.nickname ? { nickname: parsed.data.nickname } : {}),
      createdAt: new Date().toISOString(),
    });

    return res.json({ ok: true, credentialId: info.credential.id });
  } catch (err) {
    next(err);
  }
});

// ---- Auth: options ------------------------------------------------------

const AuthOptionsBody = z.object({
  email: z.string().email(),
});

webauthnRouter.post('/auth/options', async (req, res, next) => {
  try {
    const parsed = AuthOptionsBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const credentials = await listCredentials(email);
    if (credentials.length === 0) {
      return res.status(404).json({ error: 'No passkey on file for this email' });
    }
    const { rpID } = rpConfig();
    const opts = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        ...(c.transports
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { transports: c.transports as any }
          : {}),
      })),
      userVerification: 'required',
    });
    await saveChallenge({
      email,
      challenge: opts.challenge,
      purpose: 'auth',
      createdAt: Date.now(),
    });
    return res.json(opts);
  } catch (err) {
    next(err);
  }
});

// ---- Auth: verify -------------------------------------------------------

const AuthVerifyBody = z.object({
  email: z.string().email(),
  response: z.unknown(),
});

webauthnRouter.post('/auth/verify', async (req, res, next) => {
  try {
    const parsed = AuthVerifyBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const expectedChallenge = await consumeChallenge(email, 'auth');
    if (!expectedChallenge) {
      return res
        .status(400)
        .json({ error: 'No active authentication challenge — start over.' });
    }

    // Look up the credential by id from the response.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseAny = parsed.data.response as any;
    const credentialId: string | undefined = responseAny?.id;
    if (!credentialId) {
      return res.status(400).json({ error: 'Response missing credential id' });
    }
    const cred = await findCredentialById(credentialId);
    if (!cred || cred.email !== email) {
      return res.status(401).json({ error: 'Unknown credential for this email' });
    }

    const { rpID } = rpConfig();
    const verification = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: parsed.data.response as any,
      expectedChallenge,
      expectedOrigin: expectedOriginsFor(req.get('origin') ?? undefined),
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
        counter: cred.counter,
        ...(cred.transports
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { transports: cred.transports as any }
          : {}),
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Signature did not verify' });
    }

    await bumpCredentialCounter(
      cred.credentialId,
      verification.authenticationInfo.newCounter,
    );

    return res.json({ ok: true, email });
  } catch (err) {
    next(err);
  }
});
