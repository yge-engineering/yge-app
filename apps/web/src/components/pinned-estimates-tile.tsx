'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface PinnedEstimate {
  id: string;
  jobNumber: string;
  projectName: string;
  bidPriceCents: number;
  client: string | null;
}

interface Resp {
  total: number;
  estimates: PinnedEstimate[];
}

export function PinnedEstimatesTile() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-estimates/pinned-list`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data || data.total === 0) return null;

  return (
    <section className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-yellow-800">
        📌 Pinned estimates
      </h2>
      <ul className="divide-y divide-yellow-200 text-sm">
        {data.estimates.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-2 py-1.5">
            <Link href={`/imported-estimates/${e.id}`} className="text-yge-blue-900 hover:underline">
              {e.jobNumber} · {e.projectName}
            </Link>
            <span className="font-mono text-xs"><Money cents={e.bidPriceCents} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
