'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  agency: string;
  total: number;
  won: number;
  lost: number;
  noAward: number;
  tbd: number;
  winRate: number;
}

export function ByAgencyTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results/by-agency`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: Row[] }) => setRows(j.rows ?? []));
  }, []);

  if (rows === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded yet. Add a result on the job page to see win
        rate data here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Agency / Client</th>
            <th className="px-3 py-2 text-right">Total bids</th>
            <th className="px-3 py-2 text-right">Won</th>
            <th className="px-3 py-2 text-right">Lost</th>
            <th className="px-3 py-2 text-right">No award</th>
            <th className="px-3 py-2 text-right">TBD</th>
            <th className="px-3 py-2 text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rateColor = r.winRate >= 0.5 ? 'text-green-700' : r.winRate >= 0.25 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={r.agency} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.agency}</td>
                <td className="px-3 py-2 text-right font-mono">{r.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{r.won}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{r.lost}</td>
                <td className="px-3 py-2 text-right font-mono">{r.noAward}</td>
                <td className="px-3 py-2 text-right font-mono">{r.tbd}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${rateColor}`}>
                  {(r.winRate * 100).toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
