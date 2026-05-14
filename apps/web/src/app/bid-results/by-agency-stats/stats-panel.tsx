'use client';

import { useEffect, useState } from 'react';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; ownerAgency?: string | null }

interface Row { agency: string; total: number; wins: number; losses: number }

export function ByAgencyStats() {
  const [results, setResults] = useState<BidResult[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!results || !jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  if (results.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded yet.
      </p>
    );
  }

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const map = new Map<string, Row>();
  for (const r of results) {
    const agency = (jobById.get(r.jobId)?.ownerAgency ?? '').trim() || '(unknown)';
    let row = map.get(agency);
    if (!row) { row = { agency, total: 0, wins: 0, losses: 0 }; map.set(agency, row); }
    row.total += 1;
    if (r.outcome === 'WON_BY_YGE') row.wins += 1;
    if (r.outcome === 'WON_BY_OTHER') row.losses += 1;
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Owner agency</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Losses</th>
            <th className="px-3 py-2 text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const decided = r.wins + r.losses;
            const wr = decided > 0 ? r.wins / decided : 0;
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={r.agency} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold text-gray-900">{r.agency}</td>
                <td className="px-3 py-2 text-right font-mono">{r.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{r.wins}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{r.losses}</td>
                <td className={`px-3 py-2 text-right font-mono ${tone}`}>{decided > 0 ? `${(wr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
