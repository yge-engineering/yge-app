// Customer rollup — jobs + estimates + bid stats for a single customer.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface JobRef {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  createdAt: string;
}

interface EstimateRef {
  id: string;
  jobNumber: string;
  projectName: string;
  jobId: string | null;
  bidPriceCents: number;
  directCostCents: number;
}

interface BidStats {
  total: number;
  won: number;
  lost: number;
  noAward: number;
  tbd: number;
  winRate: number;
}

interface Resp {
  jobs: JobRef[];
  importedEstimates: EstimateRef[];
  bidStats: BidStats;
  revenueCents: number;
}

export function CustomerRollupPanel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers/${encodeURIComponent(customerId)}/rollup`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j as Resp | null));
  }, [customerId]);

  if (!data) return <p className="text-sm text-gray-500">Loading rollup…</p>;

  const winRatePct = (data.bidStats.winRate * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Jobs" value={data.jobs.length} />
        <Tile label="Bids tracked" value={data.bidStats.total} />
        <Tile
          label="Win rate"
          value={`${winRatePct}%`}
          tone={data.bidStats.winRate >= 0.4 ? 'good' : data.bidStats.winRate >= 0.2 ? 'warn' : 'bad'}
        />
        <Tile label="Revenue" value={<Money cents={data.revenueCents} />} />
      </section>

      {data.jobs.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Jobs</h3>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {data.jobs.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between px-4 py-2">
                <Link href={`/jobs/${j.id}`} className="text-sm font-medium text-gray-900 hover:text-yge-blue-700 hover:underline">
                  {j.jobNumber} · {j.name}
                </Link>
                <span className="text-xs text-gray-500">{j.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.importedEstimates.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Imported estimates</h3>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {data.importedEstimates.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between px-4 py-2">
                <Link href={`/imported-estimates/${e.id}`} className="text-sm font-medium text-gray-900 hover:text-yge-blue-700 hover:underline">
                  {e.jobNumber} · {e.projectName}
                </Link>
                <span className="text-xs font-mono text-gray-600">
                  <Money cents={e.bidPriceCents} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.jobs.length === 0 && data.importedEstimates.length === 0 && (
        <p className="text-sm text-gray-500">No jobs or estimates linked to this customer yet.</p>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneStyle = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-yge-blue-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`text-xl font-bold ${toneStyle}`}>{value}</div>
    </div>
  );
}
