import * as React from 'react';
import { isNextInternalError } from '../lib/next-control-flow';

// Lost-bids dashboard tile — "what did the market come in at?"
//
// Lost bids are how YGE learns where its pricing sits vs the
// competition. Surfacing them on the morning dashboard keeps
// the awareness top-of-mind (and gives Brook a quick way to
// gauge market aggression for bonding conversations).
//
// Server component. Fetches priced-estimates summary, filters
// to bidStatus='lost' updated in past 30 days, takes top 3.

import Link from 'next/link';
import { formatUSD } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface EstimateSummary {
  id: string;
  projectName: string;
  ownerAgency?: string;
  bidStatus?: string;
  bidTotalCents?: number;
  updatedAt: string;
}

async function fetchEstimates(): Promise<EstimateSummary[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { estimates: EstimateSummary[] }).estimates;
  } catch {
    return [];
  }
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

async function LostBidsTileInner() {
  const all = await fetchEstimates();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const lost = all
    .filter((e) => e.bidStatus === 'lost')
    .filter((e) => new Date(e.updatedAt).getTime() >= thirtyDaysAgo)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  if (lost.length === 0) return null;

  const totalLostDollars = lost.reduce((acc, e) => acc + (e.bidTotalCents ?? 0), 0);

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Lost bids — last 30 days
          </h2>
          <p className="text-xs text-gray-600">
            {lost.length} bid{lost.length === 1 ? '' : 's'} lost ·{' '}
            <span className="font-semibold tabular-nums">
              {formatUSD(totalLostDollars, { compact: true })}
            </span>{' '}
            total submitted
          </p>
        </div>
        <Link
          href="/estimates?status=lost"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          All lost bids →
        </Link>
      </header>
      <ul className="divide-y divide-gray-100">
        {lost.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <Link
                href={`/estimates/${e.id}`}
                className="truncate font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
              >
                {e.projectName}
              </Link>
              {e.ownerAgency && (
                <span className="ml-2 text-xs text-gray-500">· {e.ownerAgency}</span>
              )}
              <div className="mt-0.5 text-[11px] text-gray-500">
                {daysAgo(e.updatedAt)}d ago
              </div>
            </div>
            {e.bidTotalCents != null && (
              <div className="text-xs tabular-nums text-gray-700">
                {formatUSD(e.bidTotalCents, { compact: true })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function LostBidsTile(): Promise<React.ReactElement | null> {
  try {
    return await LostBidsTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[LostBidsTile] render failed:', err);
    return null;
  }
}
