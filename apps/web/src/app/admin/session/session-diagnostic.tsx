'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface WhoamiResponse {
  user: { email: string; name: string; role: string } | null;
  signed: boolean;
  companyId: string | null;
}

export function SessionDiagnostic() {
  const [data, setData] = useState<WhoamiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/whoami`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        setError(`API ${res.status}`);
        return;
      }
      setData((await res.json()) as WhoamiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { void reload(); }, []);

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        Couldn't reach /api/whoami: {error}
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-gray-500">Checking session…</p>;
  }

  const rows: Array<{ label: string; value: string; tone?: 'good' | 'warn' | 'bad' }> = [];
  if (data.user) {
    rows.push({ label: 'Signed in as', value: `${data.user.name} <${data.user.email}>`, tone: 'good' });
    rows.push({ label: 'Role', value: data.user.role });
  } else {
    rows.push({ label: 'Signed in as', value: 'No user — cookie is missing or invalid', tone: 'bad' });
  }
  rows.push({
    label: 'Cookie signature',
    value: data.signed
      ? 'HMAC-SHA256 verified ✓'
      : data.user
        ? 'Legacy unsigned (set YGE_SESSION_SECRET to upgrade)'
        : '—',
    tone: data.signed ? 'good' : data.user ? 'warn' : undefined,
  });
  rows.push({
    label: 'Tenant company id',
    value: data.companyId ?? '— (falling back to header / default)',
    tone: data.companyId ? 'good' : undefined,
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="w-1/3 px-3 py-2 font-medium text-gray-700">{r.label}</td>
                <td
                  className={
                    'px-3 py-2 font-mono text-xs ' +
                    (r.tone === 'good'
                      ? 'text-green-700'
                      : r.tone === 'warn'
                        ? 'text-amber-700'
                        : r.tone === 'bad'
                          ? 'text-red-700'
                          : 'text-gray-900')
                  }
                >
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => void reload()}
        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Refresh
      </button>
      <p className="text-xs text-gray-500">
        This page calls <code className="rounded bg-gray-100 px-1">/api/whoami</code> with{' '}
        <code className="rounded bg-gray-100 px-1">credentials: 'include'</code> so the browser sends the{' '}
        <code className="rounded bg-gray-100 px-1">yge-session</code> cookie. If you see "Legacy unsigned" but expect signed,
        deploy <code className="rounded bg-gray-100 px-1">YGE_SESSION_SECRET</code> to both Vercel + the API host and
        sign back in.
      </p>
    </div>
  );
}
