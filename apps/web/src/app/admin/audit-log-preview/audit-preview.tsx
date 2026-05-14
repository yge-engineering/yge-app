'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface AuditEntry { id?: string; at?: string; actorId?: string; entity?: string; action?: string }

interface Resp { entries?: AuditEntry[] }

export function AuditPreview() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/audit-log?limit=25`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 404) {
          setUnavailable('No /api/admin/audit-log endpoint yet. This page will light up once the endpoint ships.');
          return;
        }
        if (!r.ok) {
          setUnavailable(`Endpoint returned HTTP ${r.status}.`);
          return;
        }
        const j: Resp = await r.json();
        setEntries(j.entries ?? []);
      })
      .catch(() => setUnavailable('Could not reach the audit log endpoint.'));
  }, []);

  if (unavailable) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
        {unavailable}
      </p>
    );
  }
  if (!entries) return <p className="text-sm text-gray-500">Loading…</p>;
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        No audit entries returned.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Actor</th>
            <th className="px-3 py-2">Entity</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id ?? i} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs">{e.at ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{e.actorId ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{e.entity ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{e.action ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
