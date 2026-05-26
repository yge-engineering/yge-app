import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Upcoming-bids dashboard tile — "what's the week look like."
//
// Server component — fetches the priced-estimates summary list, runs
// the upcoming-bid calendar helper, surfaces this-week + next-7-days
// counts and flags any conflicts or holiday-falling-due dates.

import Link from 'next/link';
import {
  buildUpcomingBidCalendar,
  type UpcomingBidInput,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface EstimateSummary {
  id: string;
  projectName: string;
  ownerAgency?: string;
  bidDueDate?: string;
  estimatedBidTotalCents?: number;
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

async function UpcomingBidsTileInner() {
  const estimates = await fetchEstimates();
  const today = new Date().toISOString().slice(0, 10);

  const inputs: UpcomingBidInput[] = estimates
    .filter(
      (e): e is EstimateSummary & { bidDueDate: string } =>
        typeof e.bidDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.bidDueDate),
    )
    .map((e) => ({
      id: e.id,
      projectName: e.projectName,
      bidDueDate: e.bidDueDate,
      ownerAgency: e.ownerAgency,
      estimatedBidTotalCents: e.estimatedBidTotalCents,
    }));

  const cal = buildUpcomingBidCalendar({ bids: inputs, asOfDate: today });

  // Don't render the tile when there's literally nothing on the
  // calendar — keeps the dashboard tight.
  if (cal.counts.total === 0) return null;

  const top3 = cal.rows.slice(0, 3);

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Upcoming bids
          </h2>
          <p className="text-xs text-gray-600">
            {cal.counts.total} on the calendar
            {' · '}
            <span className="font-semibold">{cal.counts.nextSevenDays}</span> due in the next 7 days
            {cal.counts.sameDayConflictCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                ⚠ {cal.counts.sameDayConflictCount} same-day conflict
                {cal.counts.sameDayConflictCount === 1 ? '' : 's'}
              </span>
            )}
            {cal.counts.nonBusinessDayCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                ⚠ {cal.counts.nonBusinessDayCount} on holiday/weekend
              </span>
            )}
          </p>
        </div>
        <Link
          href="/upcoming-bids"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Open calendar →
        </Link>
      </header>
      <ul className="divide-y divide-gray-100">
        {top3.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="flex-1">
              <Link
                href={`/estimates/${row.id}`}
                className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
              >
                {row.projectName}
              </Link>
              {row.ownerAgency && (
                <span className="ml-2 text-xs text-gray-500">· {row.ownerAgency}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-gray-600">
                {row.bidDueDate} ·{' '}
                {row.daysUntilDue === 0
                  ? 'today'
                  : row.daysUntilDue === 1
                    ? 'tomorrow'
                    : `${row.daysUntilDue}d`}
              </span>
              {/* Mirrors the upcoming-bids page: ≤2 days → cockpit
               *  jump button. The dashboard tile is the first
               *  thing Ryan sees in the morning. */}
              {row.daysUntilDue <= 2 && (
                <Link
                  href={`/estimates/${row.id}/bid-day`}
                  className="rounded bg-yge-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-yge-blue-700"
                  title="Open the bid-day cockpit"
                >
                  🎯
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function UpcomingBidsTile(): Promise<React.ReactElement | null> {
  try {
    return await UpcomingBidsTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[UpcomingBidsTile] render failed:', err);
    return null;
  }
}
