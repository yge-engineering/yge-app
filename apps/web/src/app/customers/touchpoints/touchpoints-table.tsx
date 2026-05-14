'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  name: string;
  jobsCount: number;
  lastJobAt: string | null;
  lastEstimateAt: string | null;
  lastBidAt: string | null;
  daysSinceContact: number | null;
}

export function TouchpointsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers/touchpoints`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: Row[] }) => setRows(j.rows ?? []));
  }, []);

  if (rows === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No customers yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2">Last job</th>
            <th className="px-3 py-2">Last estimate</th>
            <th className="px-3 py-2">Last bid result</th>
            <th className="px-3 py-2 text-right">Days dormant</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone =
              r.daysSinceContact === null ? 'text-gray-400'
              : r.daysSinceContact > 365 ? 'text-red-700 font-semibold'
              : r.daysSinceContact > 180 ? 'text-amber-700'
              : 'text-gray-700';
            return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <Link href={`/customers/${r.id}`} className="font-medium text-yge-blue-700 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.jobsCount}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.lastJobAt ? r.lastJobAt.slice(0, 10) : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.lastEstimateAt ? r.lastEstimateAt.slice(0, 10) : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.lastBidAt ? r.lastBidAt.slice(0, 10) : '—'}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${tone}`}>
                  {r.daysSinceContact ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
