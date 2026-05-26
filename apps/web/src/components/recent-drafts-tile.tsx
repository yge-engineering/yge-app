import * as React from 'react';
import { isNextInternalError } from '../lib/next-control-flow';

// Recent-drafts dashboard tile — "what AI runs did I do this week?"
//
// Server component. Fetches the drafts summary, filters to last 7
// days, takes top 3 by createdAt. Lets Ryan jump back into a
// recently-uploaded plan set without bouncing through /drafts.
//
// Renders nothing when no drafts exist in the window — keeps the
// dashboard tight.

import Link from 'next/link';

import { formatUSD } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface DraftSummary {
  id: string;
  createdAt: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bidItemCount: number;
  estimatedBidTotalCents?: number;
}

async function fetchDrafts(): Promise<DraftSummary[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/plans-to-estimate/drafts`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { drafts: DraftSummary[] }).drafts;
  } catch {
    return [];
  }
}

const CONFIDENCE_STYLES: Record<DraftSummary['overallConfidence'], string> = {
  HIGH: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-red-100 text-red-800',
};

function relativeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(ms / (1000 * 60));
    return `${Math.max(1, mins)}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function RecentDraftsTileInner() {
  const drafts = await fetchDrafts();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = drafts
    .filter((d) => new Date(d.createdAt).getTime() >= sevenDaysAgo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent drafts
          </h2>
          <p className="text-xs text-gray-600">
            Last 7 days of Plans-to-Estimate runs
          </p>
        </div>
        <Link
          href="/drafts"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          All drafts →
        </Link>
      </header>
      <ul className="divide-y divide-gray-100">
        {recent.map((d) => (
          <li
            key={d.id}
            className="flex items-baseline justify-between gap-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/drafts/${d.id}`}
                className="truncate font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
              >
                {d.projectName}
              </Link>
              {d.ownerAgency && (
                <span className="ml-2 text-xs text-gray-500">· {d.ownerAgency}</span>
              )}
              <div className="mt-0.5 text-[11px] text-gray-500">
                {d.bidItemCount} item{d.bidItemCount === 1 ? '' : 's'} ·{' '}
                {relativeShort(d.createdAt)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_STYLES[d.overallConfidence]}`}
              >
                {d.overallConfidence}
              </span>
              {d.estimatedBidTotalCents !== undefined && (
                <span className="text-xs tabular-nums text-gray-700">
                  {formatUSD(d.estimatedBidTotalCents, { compact: true })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function RecentDraftsTile(): Promise<React.ReactElement | null> {
  try {
    return await RecentDraftsTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[RecentDraftsTile] render failed:', err);
    return null;
  }
}
