'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { ygeBid, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; projectName: string }

function quarterOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}

export function ByQuarterDetail() {
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
  const groups = new Map<string, BidResult[]>();
  for (const r of results) {
    const k = quarterOf(r.bidOpenedAt ?? '') || '(unknown)';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-3">
      {sorted.map(([q, list]) => {
        const wins = list.filter((r) => r.outcome === 'WON_BY_YGE').length;
        return (
          <details key={q} className="rounded border border-gray-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
              <span className="font-mono font-semibold">{q}</span>
              <span className="text-xs text-gray-600">{list.length} bid{list.length === 1 ? '' : 's'} · {wins} win{wins === 1 ? '' : 's'}</span>
            </summary>
            <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
              {[...list].sort((a, b) => b.bidOpenedAt.localeCompare(a.bidOpenedAt)).map((r) => {
                const yge = ygeBid(r);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link href={`/bid-results/${r.id}`} className="font-medium text-yge-blue-700 hover:underline">
                      {jobById.get(r.jobId)?.projectName ?? r.jobId}
                    </Link>
                    <span className="font-mono text-[10px] text-gray-500">
                      {r.bidOpenedAt} · {r.outcome} {yge ? <>· <Money cents={yge.amountCents} /></> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
