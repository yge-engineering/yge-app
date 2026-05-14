// Mini bid-history sparkline (12-month rolling) for the dashboard.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface MonthBucket {
  month: string;
  wins: number;
  losses: number;
  winsCents: number;
}

export function BidSparklineTile() {
  const [months, setMonths] = useState<MonthBucket[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results/stats/sparkline`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { months: [] }))
      .then((j: { months?: MonthBucket[] }) => setMonths(j.months ?? []));
  }, []);

  if (!months || months.length === 0) return null;

  // Last 12 months max.
  const recent = months.slice(-12);
  const max = Math.max(1, ...recent.map((m) => m.wins + m.losses));
  const w = 240;
  const h = 60;
  const barW = w / recent.length;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bids — last 12 months
        </h2>
        <Link
          href="/bid-results/by-year"
          className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          YoY →
        </Link>
      </div>
      <svg width={w} height={h} className="block">
        {recent.map((m, i) => {
          const winsH = (m.wins / max) * h;
          const lossH = (m.losses / max) * h;
          return (
            <g key={m.month}>
              <rect x={i * barW} y={h - winsH} width={barW * 0.4} height={winsH} fill="#16a34a" />
              <rect x={i * barW + barW * 0.5} y={h - lossH} width={barW * 0.4} height={lossH} fill="#dc2626" />
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-gray-500">
        Green = won · Red = lost · {recent[0]?.month} → {recent[recent.length - 1]?.month}
      </p>
    </section>
  );
}
