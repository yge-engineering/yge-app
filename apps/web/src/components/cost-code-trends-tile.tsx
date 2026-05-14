'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Trend {
  code: string;
  latestCents: number;
  previousCents: number;
  deltaPct: number;
  samples: number;
  direction: 'up' | 'down' | 'flat';
}

interface Resp {
  trends: Trend[];
  climbing: Trend[];
  falling: Trend[];
}

export function CostCodeTrendsTile() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes/trends`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { trends: [], climbing: [], falling: [] }))
      .then((j: Resp) => setData(j));
  }, []);

  if (!data) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Cost code trends
        </h2>
        <p className="text-sm text-gray-500">Loading…</p>
      </section>
    );
  }

  const top = data.climbing.slice(0, 5);
  if (top.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
          ⚠ Trending up
        </h2>
        <Link
          href="/cost-codes"
          className="rounded border border-amber-500 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
        >
          All codes &rarr;
        </Link>
      </div>
      <ul className="divide-y divide-amber-200 text-xs">
        {top.map((t) => (
          <li key={t.code} className="flex items-center justify-between py-1.5">
            <span className="font-mono text-amber-900">{t.code}</span>
            <span className="flex items-center gap-2">
              <Money cents={t.previousCents} />
              <span className="text-amber-700">→</span>
              <span className="font-mono font-semibold">
                <Money cents={t.latestCents} />
              </span>
              <span className="rounded bg-amber-200 px-1 py-0.5 text-[10px] font-bold text-amber-900">
                +{(t.deltaPct * 100).toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
