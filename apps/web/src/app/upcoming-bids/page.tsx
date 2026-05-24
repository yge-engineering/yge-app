// /upcoming-bids — week-by-week pursuit calendar.
//
// Server-component view that turns the priced-estimates summary list
// into a calendar of upcoming bid openings, grouped by ISO week,
// with same-day conflicts + holiday-falling-due-dates flagged.

import Link from 'next/link';

import { AppShell, PageHeader, Alert } from '../../components';
import {
  buildUpcomingBidCalendar,
  formatUSD,
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
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { estimates: EstimateSummary[] };
  return json.estimates;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtWeekRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtBidDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default async function UpcomingBidsPage() {
  let estimates: EstimateSummary[] = [];
  let fetchError: string | null = null;
  try {
    estimates = await fetchEstimates();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'fetch failed';
  }

  // Only estimates with an explicit bid due date can be put on a
  // calendar. Filter, then normalize for the helper.
  const inputs: UpcomingBidInput[] = estimates
    .filter((e): e is EstimateSummary & { bidDueDate: string } =>
      typeof e.bidDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.bidDueDate),
    )
    .map((e) => ({
      id: e.id,
      projectName: e.projectName,
      bidDueDate: e.bidDueDate,
      ownerAgency: e.ownerAgency,
      estimatedBidTotalCents: e.estimatedBidTotalCents,
    }));

  const cal = buildUpcomingBidCalendar({
    bids: inputs,
    asOfDate: todayIso(),
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Upcoming bids"
          subtitle="Week-by-week pursuit calendar. Conflicts (two bids same day) and holiday-falling-due dates are flagged."
        />

        {fetchError && (
          <Alert tone="danger" className="mt-4">
            Couldn&apos;t load estimates: {fetchError}
          </Alert>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TileMini label="Upcoming" value={cal.counts.total} />
          <TileMini label="Next 7 days" value={cal.counts.nextSevenDays} />
          <TileMini
            label="Same-day conflicts"
            value={cal.counts.sameDayConflictCount}
            warn={cal.counts.sameDayConflictCount > 0}
          />
          <TileMini
            label="Holiday/weekend"
            value={cal.counts.nonBusinessDayCount}
            warn={cal.counts.nonBusinessDayCount > 0}
          />
        </div>

        {cal.weeks.length === 0 && !fetchError && (
          <p className="mt-6 rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No upcoming bids on the calendar. Add a bid due date on an estimate to put it here.
          </p>
        )}

        <div className="mt-6 space-y-5">
          {cal.weeks.map((week) => (
            <section
              key={week.weekStart}
              className="rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <header className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Week of {fmtWeekRange(week.weekStart, week.weekEnd)}
                  <span className="ml-2 text-xs font-normal lowercase tracking-normal text-gray-500">
                    {week.rows.length} bid{week.rows.length === 1 ? '' : 's'}
                  </span>
                </h3>
              </header>
              <ul className="divide-y divide-gray-100">
                {week.rows.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                    <div className="flex-1">
                      <Link
                        href={`/estimates/${row.id}`}
                        className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {row.projectName}
                      </Link>
                      <div className="mt-0.5 text-xs text-gray-600">
                        {fmtBidDate(row.bidDueDate)}
                        {row.ownerAgency && (
                          <span className="ml-2 text-gray-500">· {row.ownerAgency}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {row.sameDayConflict && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                            Same-day conflict
                          </span>
                        )}
                        {row.fallsOnNonBusinessDay && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-900">
                            Falls on weekend / holiday — verify with agency
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {row.estimatedBidTotalCents != null ? (
                        <div className="text-sm font-semibold tabular-nums text-gray-900">
                          {formatUSD(row.estimatedBidTotalCents, { compact: true })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      <div className="text-[11px] tabular-nums text-gray-500">
                        {row.daysUntilDue === 0
                          ? 'today'
                          : row.daysUntilDue === 1
                            ? 'tomorrow'
                            : `${row.daysUntilDue} days`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}

function TileMini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const tone = warn && value > 0
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-md border p-4 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
