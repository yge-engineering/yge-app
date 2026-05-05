'use client';

// PortalUsersClient — table of portal users + inline role editor +
// invite form + delete buttons.
//
// All mutations go to /api/portal-users; on success we refresh
// state from the server so concurrent edits don't drift. Optimistic
// updates would be nice but aren't worth the bug surface for an
// admin page used a few times a week.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  portalRoleLabel,
  type PortalRole,
  type PortalUser,
} from '@yge/shared';

const ROLES: PortalRole[] = [
  'PRESIDENT',
  'VP',
  'OFFICE',
  'PROJECT_MANAGER',
  'FOREMAN',
  'CREW',
];

interface Props {
  initialUsers: PortalUser[];
  apiBaseUrl: string;
}

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PortalUsersClient({ initialUsers, apiBaseUrl }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<PortalUser[]>(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<PortalRole>('FOREMAN');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch(`${apiBaseUrl}/api/portal-users`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { users?: PortalUser[] };
      setUsers(json.users ?? []);
    } catch {
      // best-effort
    }
  }

  async function changeRole(id: string, role: PortalRole) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/portal-users/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Role change failed (${res.status}): ${text.slice(0, 200)}`);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role change failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDisabled(user: PortalUser) {
    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/portal-users/${encodeURIComponent(user.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: !user.disabled }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Update failed (${res.status}): ${text.slice(0, 200)}`);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(user: PortalUser) {
    if (
      !window.confirm(
        `Revoke portal access for ${user.name} (${user.email})? This permanently removes their login. To temporarily disable, use the Disable button instead.`,
      )
    )
      return;
    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/portal-users/${encodeURIComponent(user.id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Revoke failed (${res.status})`);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError('Email and name are required.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/portal-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Invite failed (${res.status})`);
      }
      setInviteSuccess(
        `${inviteName.trim()} added. Send them app.youngge.com so they can sign in and pick a password.`,
      );
      setInviteEmail('');
      setInviteName('');
      setInviteRole('FOREMAN');
      await reload();
      router.refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed.');
    } finally {
      setInviting(false);
    }
  }

  const sorted = [...users].sort((a, b) => {
    // Owners first, then disabled rows last.
    const order = (u: PortalUser) =>
      u.disabled ? 99 : ROLES.indexOf(u.role);
    return order(a) - order(b) || a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Password</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((u) => (
              <tr key={u.id} className={u.disabled ? 'bg-gray-50 text-gray-500' : ''}>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {u.name}
                  {u.disabled && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      DISABLED
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      void changeRole(u.id, e.target.value as PortalRole)
                    }
                    disabled={busyId === u.id}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {portalRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.hasPassword ? (
                    <span className="text-green-700">✓ Set</span>
                  ) : (
                    <span className="text-amber-700">Pending</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {formatWhen(u.lastLoginAt)}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <button
                    type="button"
                    onClick={() => void toggleDisabled(u)}
                    disabled={busyId === u.id}
                    className="font-medium text-amber-700 hover:underline disabled:opacity-50"
                  >
                    {u.disabled ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revoke(u)}
                    disabled={busyId === u.id}
                    className="ml-3 font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      <form
        onSubmit={invite}
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold text-gray-900">
          Invite a new portal user
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          They'll be able to sign in at app.youngge.com using this email. Their
          first sign-in lets them pick a password. Pick the role carefully — it
          decides which pages they see (foremen don't see estimating dollars or
          AP/AR; crew only sees safety docs and their own profile).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Name</span>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              placeholder="Full name"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Work email
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="firstname@youngge.com"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Role</span>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as PortalRole)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {portalRoleLabel(r)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {inviteError && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {inviteError}
          </div>
        )}
        {inviteSuccess && (
          <div className="mt-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
            {inviteSuccess}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {inviting ? 'Inviting…' : 'Invite user'}
          </button>
        </div>
      </form>

      {/* Role cheat sheet */}
      <details className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
        <summary className="cursor-pointer font-semibold text-gray-900">
          What does each role see?
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-gray-700">
          <li>
            <strong>President / VP</strong> — full access. Owners.
          </li>
          <li>
            <strong>Office</strong> — estimating, AP/AR, financials, jobs,
            crew, safety, employees. No portal-user management.
          </li>
          <li>
            <strong>Project Manager</strong> — view estimates + jobs, edit
            crew schedule, see safety docs, employees roster (read-only). No
            financial editing.
          </li>
          <li>
            <strong>Foreman</strong> — only their <em>assigned</em> jobs (set
            below soon), crew schedule for their crew, safety docs. No
            estimating dollars or AP/AR.
          </li>
          <li>
            <strong>Crew member</strong> — own profile + own time card +
            safety docs only.
          </li>
        </ul>
      </details>
    </div>
  );
}
