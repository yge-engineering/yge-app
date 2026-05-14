'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { winningAmountCents, ygeBid, ygeDeltaToWinnerCents, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; projectName: string }

export function LossesTable() {
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

  const rows = results
    .filter((r) => r.outcome === 'WON_BY_OTHER')
    .sort((a, b) => b.bidOpenedAt.localeCompare(a.bidOpenedAt));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No losses recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2 text-right">YGE bid</th>
            <th className="px-3 py-2 text-right">Winning bid</th>
            <th className="px-3 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const yge = ygeBid(r);
            const win = winningAmountCents(r);
            const delta = ygeDeltaToWinnerCents(r);
            return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.bidOpenedAt}</td>
                <td className="px-3 py-2">
                  <Link href={`/bid-results/${r.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                    {jobById.get(r.jobId)?.projectName ?? r.jobId}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {yge ? <Money cents={yge.amountCents} /> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {win !== undefined ? <Money cents={win} /> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-amber-700">
                  {delta !== undefined && delta > 0 ? <Money cents={delta} /> : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
