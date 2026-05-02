// E-signature signing form with email-OTP attribution.
//
// Flow:
//   1. Operator types name + checks consent box (same as the
//      typed-only form), THEN the 'Send code' button issues an
//      email OTP to the signer's email address.
//   2. Operator types the 6-digit code into the verify field.
//   3. On verify, the form calls /api/signatures/:id/sign with
//      authMethod='EMAIL_OTP', authChallengeId=<otp id>, and
//      authenticatedAt=<verify response timestamp>. That's the
//      ESIGN attribution proof — a court can trace 'this signature
//      came from someone who controlled this email at this
//      timestamp'.
//
// Dev-mode: when the API is started with OTP_DEV_REVEAL=1, the
// /api/otp/request response includes the code in `devCode`. This
// form surfaces it inline so devs can sign without checking
// stderr.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sha256Hex } from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  signatureId: string;
  expectedSignerName: string;
  signerEmail: string;
  disclosureText: string;
  affirmationText: string;
}

interface OtpRequestResponse {
  challenge: { id: string; expiresAt: string };
  devCode?: string;
}

interface OtpVerifyResponse {
  outcome:
    | { result: 'OK' }
    | { result: 'WRONG_CODE'; attemptsRemaining: number }
    | { result: 'EXPIRED' }
    | { result: 'EXHAUSTED' }
    | { result: 'NOT_PENDING'; status: string };
  challenge: { verifiedAt?: string };
}

type Stage = 'AFFIRM' | 'CODE_ISSUED' | 'VERIFIED' | 'SIGNED';

export function SignFormOtp({
  apiBaseUrl,
  signatureId,
  expectedSignerName,
  signerEmail,
  disclosureText,
  affirmationText,
}: Props) {
  const router = useRouter();
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('AFFIRM');
  const [busy, setBusy] = useState<'request' | 'verify' | 'sign' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  const namesMatch =
    typedName.trim().toLowerCase() === expectedSignerName.trim().toLowerCase();
  const affirmReady = namesMatch && agreed;

  async function requestCode() {
    if (!affirmReady || busy) return;
    setBusy('request');
    setError(null);
    setDevCode(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'EMAIL',
          purpose: `sig:${signatureId}`,
          channelTarget: signerEmail,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `OTP request failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as OtpRequestResponse;
      setOtpId(json.challenge.id);
      if (json.devCode) setDevCode(json.devCode);
      setStage('CODE_ISSUED');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function verifyAndSign() {
    if (!otpId || code.length !== 6 || busy) return;
    setBusy('verify');
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: otpId, code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `OTP verify failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as OtpVerifyResponse;
      if (json.outcome.result === 'WRONG_CODE') {
        setError(`Wrong code. ${json.outcome.attemptsRemaining} attempts remaining.`);
        return;
      }
      if (json.outcome.result === 'EXPIRED') {
        setError('Code expired. Click "Send code" to issue a new one.');
        setStage('AFFIRM');
        return;
      }
      if (json.outcome.result === 'EXHAUSTED') {
        setError('Too many wrong codes. Start a new signing session.');
        return;
      }
      if (json.outcome.result === 'NOT_PENDING') {
        setError(`Challenge already ${json.outcome.status.toLowerCase()}. Start a new signing session.`);
        return;
      }
      // OK — proceed to /sign
      const verifiedAtIso = json.challenge.verifiedAt ?? new Date().toISOString();
      setVerifiedAt(verifiedAtIso);
      setStage('VERIFIED');
      setBusy('sign');
      const now = new Date();
      const disclosureSha256 = await sha256Hex(disclosureText);
      const signRes = await fetch(`${apiBaseUrl}/api/signatures/${signatureId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: {
            agreedAt: now.toISOString(),
            disclosureSha256,
            affirmationText,
          },
          authContext: {
            authMethod: 'EMAIL_OTP',
            authenticatedAt: verifiedAtIso,
            authChallengeId: otpId,
            userAgent: navigator.userAgent,
          },
          signedAt: now.toISOString(),
        }),
      });
      if (!signRes.ok) {
        const body = (await signRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Sign failed (${signRes.status})`);
        return;
      }
      setStage('SIGNED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Affirm + verify
      </h2>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Type your full name as it appears on the document
        </span>
        <input
          type="text"
          autoComplete="off"
          required
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          disabled={stage !== 'AFFIRM'}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono disabled:bg-gray-100"
          placeholder={expectedSignerName}
        />
        <span
          className={`mt-1 block text-xs ${
            typedName.length === 0
              ? 'text-gray-500'
              : namesMatch
                ? 'text-emerald-700'
                : 'text-amber-700'
          }`}
        >
          {typedName.length === 0
            ? `Expected: ${expectedSignerName}`
            : namesMatch
              ? '✓ Matches the name on this signature row'
              : `Doesn't match "${expectedSignerName}".`}
        </span>
      </label>

      <label className="mb-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={stage !== 'AFFIRM'}
          className="mt-0.5"
        />
        <span className="text-gray-800">{affirmationText}</span>
      </label>

      {stage === 'AFFIRM' && (
        <button
          type="button"
          onClick={requestCode}
          disabled={!affirmReady || busy != null}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'request' ? 'Sending code…' : `Send code to ${signerEmail}`}
        </button>
      )}

      {stage === 'CODE_ISSUED' && (
        <div className="mt-2 rounded border border-yge-blue-500 bg-yge-blue-50 p-3">
          <p className="mb-2 text-sm text-gray-900">
            We sent a 6-digit code to <strong>{signerEmail}</strong>. Type it below.
          </p>
          {devCode && (
            <p className="mb-2 text-xs text-gray-500">
              Dev mode: code is <code className="font-mono text-sm text-gray-900">{devCode}</code>.
            </p>
          )}
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="rounded border border-gray-300 px-3 py-2 text-lg font-mono tracking-widest"
              placeholder="000000"
            />
            <button
              type="button"
              onClick={verifyAndSign}
              disabled={code.length !== 6 || busy != null}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {busy === 'verify' ? 'Verifying…' : busy === 'sign' ? 'Signing…' : 'Verify + sign'}
            </button>
          </div>
        </div>
      )}

      {stage === 'SIGNED' && (
        <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✓ Signed and verified at {verifiedAt}.
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        The OTP confirms control of the signer&rsquo;s email — the
        attribution element of the ESIGN/UETA proof bundle. The challenge
        id, the verified-at timestamp, and the auth method land on the
        signature row's auditContext.
      </p>
    </section>
  );
}
