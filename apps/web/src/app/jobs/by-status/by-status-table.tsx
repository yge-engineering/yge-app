'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface StatsResp {
  total: number;
  byStatus: Record<string, number>;
  byRateType: Record<string, number>;
}

const STATUS_ORDER = ['PROSPECT', 'PURSUING', 'BID_SUBMITTED', 'AWARDED', 'ACTIVE', 'CLOSED', 'LOST', 'NO_BID', 'ARCHIVED'];

export function ByStatusTable() {
  const [stats, setStats] = useState<StatsResp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: StatsResp | null) => setStats(j));
  }, []);

  if (!stats) return <p className="text-sm text-gray-500">Loading…</p>;
  if (stats.total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No jobs in the database yet.
      </p>
    );
  }

  const known = new Set(STATUS_ORDER);
  const rows: Array<[string, number]> = [];
  for (const s of STATUS_ORDER) {
    rows.push([s, stats.byStatus[s] ?? 0]);
  }
  for (const s of Object.keys(stats.byStatus)) {
    if (!known.has(s)) rows.push([s, stats.byStatus[s] ?? 0]);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">% of total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([status, count]) => {
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <tr key={status} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{status}</td>
                <td className="px-3 py-2 text-right font-mono">{count}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{stats.total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
