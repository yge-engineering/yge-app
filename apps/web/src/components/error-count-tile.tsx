import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard error-count tile.
//
// Server component — fetches recent api_errors counts from
// /api/admin/errors and renders an inline summary. Hidden when
// the user lacks audit:view permission.

import Link from 'next/link';

interface ApiErrorRow {
  id: string;
  occurredAt: string;
  statusCode: number;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchErrorsSince(daysBack: number): Promise<ApiErrorRow[]> {
  try {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const res = await fetch(
      `${apiBaseUrl()}/api/admin/errors?since=${since}&limit=500`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return ((await res.json()) as { errors: ApiErrorRow[] }).errors;
  } catch {
    return [];
  }
}

async function ErrorCountTileInner() {
  const errors = await fetchErrorsSince(7);
  const today = new Date().toISOString().slice(0, 10);
  const todays = errors.filter((e) => e.occurredAt.slice(0, 10) === today);
  const week = errors.length;

  // Only render the tile when there's at least one captured error
  // OR when we want to confirm the system is healthy. Show a quiet
  // "all clear" line when zero so the user trusts the tile is live.
  const tone =
    todays.length > 0
      ? 'border-red-300 bg-red-50 text-red-900'
      : week > 0
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-green-300 bg-green-50 text-green-900';

  return (
    <section className={`mb-6 rounded-md border px-4 py-3 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>Server health:</strong>{' '}
          {todays.length === 0 && week === 0 ? (
            <>No captured errors in the last 7 days. ✓</>
          ) : todays.length > 0 ? (
            <>
              ⚠ {todays.length} error{todays.length === 1 ? '' : 's'} today
              · {week} this week
            </>
          ) : (
            <>{week} error{week === 1 ? '' : 's'} this week (none today)</>
          )}
        </div>
        <Link
          href="/admin/errors"
          className="text-xs font-semibold underline hover:no-underline"
        >
          Open server errors →
        </Link>
      </div>
    </section>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function ErrorCountTile(): Promise<React.ReactElement | null> {
  try {
    return await ErrorCountTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[ErrorCountTile] render failed:', err);
    return null;
  }
}

