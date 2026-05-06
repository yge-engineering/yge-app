'use client';

// Passkey registration UI. User types an optional nickname (e.g.
// "Ryan's iPhone"), clicks the button, and the browser asks the OS
// to mint a new credential. We send the public-key half back to the
// server.

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import {
  finishPasskeyRegister,
  startPasskeyRegister,
} from './actions';

export function PasskeyRegister() {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const begin = await startPasskeyRegister(nickname);
      if (!begin.ok || !begin.options) {
        setError(begin.error ?? 'Could not start');
        setBusy(false);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attestation = await startRegistration(begin.options as any);
      const finish = await finishPasskeyRegister(nickname, attestation);
      if (!finish.ok) {
        setError(finish.error ?? 'Registration failed');
        setBusy(false);
        return;
      }
      setDone(true);
      setNickname('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancelled';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-gray-700">Nickname (optional)</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ryan's iPhone"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          maxLength={100}
        />
      </label>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {busy ? 'Waiting for device…' : 'Set up Face ID / Touch ID'}
      </button>
      {error && <p className="text-xs text-red-700">⚠ {error}</p>}
      {done && (
        <p className="text-xs text-green-700">
          ✓ Passkey saved. Next time you sign in, tap "Sign in with Face ID /
          Touch ID" on the login screen.
        </p>
      )}
    </div>
  );
}
