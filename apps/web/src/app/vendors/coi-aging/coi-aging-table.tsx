'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  legalName: string;
  kind: string;
  coiExpiresAt: string | null;
  daysUntilExpiry: number | null;
  severity: 'expired' | 'expiring' | 'current' | 'unknown';
  email: string | null;
}

interface Resp {
  rows: Row[];
  expired: number;
  expiring: number;
  unknown: number;
}

const SEV_TONE: Record<Row['severity'], string> = {
  expired: 'bg-red-100 text-red-800 border-red-300',
  expiring: 'bg-amber-100 text-amber-800 border-amber-300',
  current: 'bg-green-100 text-green-800 border-green-300',
  unknown: 'bg-gray-100 text-gray-700 border-gray-300',
};

export function CoiAgingTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors/coi-aging`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label="Expired" value={data.expired} tone="bg-red-50 text-red-800" />
        <Tile label="Expiring ≤30d" value={data.expiring} tone="bg-amber-50 text-amber-800" />
        <Tile label="Unknown" value={data.unknown} tone="bg-gray-50 text-gray-700" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Sub</th>
              <th className="px-3 py-2">COI expires</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Chase</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEV_TONE[r.severity]}`}>
                    {r.severity}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/vendors/${r.id}`} className="font-medium text-yge-blue-700 hover:underline">
                    {r.legalName || r.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.coiExpiresAt ?? '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.daysUntilExpiry === null ? '—' : r.daysUntilExpiry}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.email && (r.severity === 'expired' || r.severity === 'expiring') ? (
                    <a
                      href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('COI expiring — please send updated certificate')}&body=${encodeURIComponent(`Hi,\n\nOur records show your certificate of insurance with us expires ${r.coiExpiresAt}. Please send an updated COI naming Young General Engineering, Inc. as additional insured at your earliest convenience.\n\nThanks,\nRyan Young\nYGE\n707-599-9921`)}`}
                      className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-700 hover:bg-yge-blue-50"
                    >
                      Compose chase email
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
