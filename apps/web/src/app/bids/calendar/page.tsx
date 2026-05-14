// /bids/calendar — upcoming bid deadlines grouped by week.

import Link from 'next/link';
import type { Job } from '@yge/shared';
import { AppShell, PageHeader } from '../../../components';
import { Letterhead } from '../../../components/letterhead';
import { PrintButton } from '../../../components/print-button';
import { requirePermission } from '../../../lib/permissions';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs?: Job[] }).jobs ?? [];
  } catch {
    return [];
  }
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // Accept yyyy-mm-dd, ignore time component.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function weekStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  out.setDate(out.getDate() + diff);
  return out;
}

function daysFromNow(target: Date, now: Date): number {
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / (1000 * 60 * 60 * 24));
}

interface BidRow {
  job: Job;
  date: Date;
  daysFromNow: number;
}

interface WeekGroup {
  weekStart: Date;
  rows: BidRow[];
}

export default async function BidsCalendarPage() {
  requirePermission('estimates:view');
  const jobs = await fetchJobs();
  const now = new Date();

  const rows: BidRow[] = [];
  for (const j of jobs) {
    if (j.status !== 'PURSUING' && j.status !== 'PROSPECT') continue;
    const d = parseDate(j.bidDueDate);
    if (!d) continue;
    rows.push({ job: j, date: d, daysFromNow: daysFromNow(d, now) });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  const overdue = rows.filter((r) => r.daysFromNow < 0);
  const upcoming = rows.filter((r) => r.daysFromNow >= 0);

  const byWeek = new Map<number, WeekGroup>();
  for (const r of upcoming) {
    const ws = weekStart(r.date);
    const key = ws.getTime();
    let g = byWeek.get(key);
    if (!g) {
      g = { weekStart: ws, rows: [] };
      byWeek.set(key, g);
    }
    g.rows.push(r);
  }
  const weeks = [...byWeek.values()].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Bid calendar"
          subtitle={`${overdue.length} overdue · ${upcoming.length} upcoming`}
          actions={<PrintButton label="Print / Save as PDF" />}
        />

        <div className="hidden print:block mb-4">
          <Letterhead variant="full" />
          <p className="mt-2 text-xs text-gray-700">
            Bid calendar — generated {new Date().toLocaleString()}
          </p>
        </div>

        {overdue.length > 0 && (
          <section className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 print:break-inside-avoid">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-800">
              Past due (still in pursuit)
            </h2>
            <ul className="divide-y divide-red-200">
              {overdue.map((r) => (
                <BidRowItem key={r.job.id} row={r} />
              ))}
            </ul>
          </section>
        )}

        {weeks.length === 0 && overdue.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No upcoming bid deadlines. Add <code>bidDueDate</code> to a pursuing
            job to see it here.
          </p>
        )}

        {weeks.map((w) => (
          <section key={w.weekStart.getTime()} className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm print:break-inside-avoid">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                Week of {fmtWeek(w.weekStart)}
              </h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {w.rows.map((r) => (
                <BidRowItem key={r.job.id} row={r} />
              ))}
            </ul>
          </section>
        ))}
      </main>
    </AppShell>
  );
}

function BidRowItem({ row }: { row: BidRow }) {
  const tone =
    row.daysFromNow < 0
      ? 'text-red-800 bg-red-100'
      : row.daysFromNow <= 3
      ? 'text-amber-800 bg-amber-100'
      : 'text-gray-700 bg-gray-100';
  const label =
    row.daysFromNow < 0
      ? `${Math.abs(row.daysFromNow)}d overdue`
      : row.daysFromNow === 0
      ? 'Due today'
      : `in ${row.daysFromNow}d`;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/jobs/${row.job.id}`}
          className="text-sm font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
        >
          {row.job.projectName}
        </Link>
        <div className="text-xs text-gray-500">
          {row.job.ownerAgency ?? '—'}
          {row.job.location ? ` · ${row.job.location}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono text-gray-600">{fmtDate(row.date)}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>
          {label}
        </span>
      </div>
    </li>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtWeek(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
