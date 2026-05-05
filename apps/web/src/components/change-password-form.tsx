'use client';

// ChangePasswordForm — small client island on /profile that POSTs
// to /api/credentials/change-password. Verifies the current password
// before replacing the hash. Successful change shows an inline
// confirmation; errors stay on the form.
//
// Shipped in bundle 897.

import { useState } from 'react';

interface Props {
  email: string;
  apiBaseUrl: string;
}

export function ChangePasswordForm({ email, apiBaseUrl }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/credentials/change-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, oldPassword, newPassword }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Change failed (${res.status})`);
      }
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Change failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-900">Change password</h2>
      <p className="text-xs text-gray-600">
        Type your current password, then a new one. Minimum 8 characters.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Current password
        </span>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          New password
        </span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Confirm new password
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">
          Password changed. Use your new password the next time you sign in.
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
