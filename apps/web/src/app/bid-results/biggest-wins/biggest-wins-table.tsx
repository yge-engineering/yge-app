'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Bidder { bidderName?: string; amountCents?: number; isYge?: boolean }

interface BidResult {
  id: string;
  jobId: string;
  bidOpenedAt: string;
  outcome: string;
  bidders?: Bidder[];
}

interface Job { id: string; projectName: string }

interface WinRow {
  id: string;
  jobId: string;
  projectName: string;
  bidOpenedAt: string;
  amountCents: number;
}

export function BiggestWinsTable() {
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

  const wins: WinRow[] = [];
  for (const r of results) {
    if (r.outcome !== 'WON_BY_YGE') continue;
    const yge = (r.bidders ?? []).find((b) => b.isYge);
    if (!yge?.amountCents) continue;
    wins.push({
      id: r.id,
      jobId: r.jobId,
      projectName: jobById.get(r.jobId)?.projectName ?? r.jobId,
      bidOpenedAt: r.bidOpenedAt,
      amountCents: yge.amountCents,
    });
  }
  wins.sort((a, b) => b.amountCents - a.amountCents);
  const top = wins.slice(0, 25);

  if (top.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No recorded YGE wins yet.
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
          </tr>
        </thead>
        <tbody>
          {top.map((w, i) => (
            <tr key={w.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-gray-500">#{i + 1}</td>
              <td className="px-3 py-2">
                <Link href={`/bid-results/${w.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {w.projectName}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{w.bidOpenedAt}</td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={w.amountCents} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
