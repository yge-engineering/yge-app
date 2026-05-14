'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { ygeBid, ygeDeltaToWinnerCents, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; projectName: string }

interface MissRow {
  id: string;
  jobId: string;
  projectName: string;
  bidOpenedAt: string;
  ygeAmount: number;
  deltaCents: number;
}

export function ClosestMissesTable() {
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
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const misses: MissRow[] = [];
  for (const r of results) {
    if (r.outcome !== 'WON_BY_OTHER') continue;
    const yge = ygeBid(r);
    const delta = ygeDeltaToWinnerCents(r);
    if (!yge || delta === undefined || delta <= 0) continue;
    misses.push({
      id: r.id,
      jobId: r.jobId,
      projectName: jobById.get(r.jobId)?.projectName ?? r.jobId,
      bidOpenedAt: r.bidOpenedAt,
      ygeAmount: yge.amountCents,
      deltaCents: delta,
    });
  }
  misses.sort((a, b) => a.deltaCents - b.deltaCents);
  const top = misses.slice(0, 25);

  if (top.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No close-miss data yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Rank</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Bid date</th>
            <th className="px-3 py-2 text-right">YGE bid</th>
            <th className="px-3 py-2 text-right">Gap to winner</th>
            <th className="px-3 py-2 text-right">% over</th>
          </tr>
        </thead>
        <tbody>
          {top.map((m, i) => {
            const pct = m.ygeAmount > 0 ? (m.deltaCents / m.ygeAmount) * 100 : 0;
            return (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-gray-500">#{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`/bid-results/${m.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                    {m.projectName}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{m.bidOpenedAt}</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={m.ygeAmount} /></td>
                <td className="px-3 py-2 text-right font-mono text-amber-700"><Money cents={m.deltaCents} /></td>
                <td className="px-3 py-2 text-right font-mono text-amber-700">{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
