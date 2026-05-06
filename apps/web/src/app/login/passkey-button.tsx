'use client';

// Sign in with Face ID / Touch ID / Windows Hello / hardware key.
//
// Plain English: if the user has set up a passkey on this device, this
// button skips the password entirely. Tap → OS prompt → in.
//
// We hide the button on browsers that don't support WebAuthn at all
// (very rare in 2026, but worth the cheap check). The button is still
// shown on devices that support WebAuthn but have no passkey on file —
// the API returns a friendly error explaining how to set one up.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from '@simplewebauthn/browser';
import {
  finishPasskeyAuth,
  startPasskeyAuth,
} from './passkey-actions';

export function PasskeyButton({ emailHint }: { emailHint?: string }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  if (!supported) return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      // Use the email already typed into the form, falling back to the
      // ?email= URL hint or a prompt.
      let email = emailHint?.trim() ?? '';
      if (!email && typeof window !== 'undefined') {
        const fromInput = (
          document.querySelector('input[name="email"]') as HTMLInputElement | null
        )?.value;
        email = fromInput?.trim() ?? '';
      }
      if (!email) {
        email = window.prompt('Enter your work email to sign in with Face ID:') ?? '';
      }
      if (!email) {
        setBusy(false);
        return;
      }

      const begin = await startPasskeyAuth(email);
      if (!begin.ok || !begin.options) {
        setError(begin.error ?? 'Could not start');
        setBusy(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assertion = await startAuthentication(begin.options as any);
      const finish = await finishPasskeyAuth(email, assertion);
      if (!finish.ok) {
        setError(finish.error ?? 'Sign-in failed');
        setBusy(false);
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      // User cancelled or device declined — surface a friendly message.
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled';
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        <span aria-hidden className="text-base">🔐</span>
        {busy ? 'Waiting for device…' : 'Sign in with Face ID / Touch ID'}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
