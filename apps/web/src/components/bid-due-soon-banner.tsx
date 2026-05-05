// BidDueSoonBanner — surfaces jobs with a bid due date inside a 14-day
// window that aren't already submitted, so estimators don't miss
// deadlines.
//
// Plain English: heavy-civil bids stack up — Caltrans on Tuesday,
// county on Thursday, federal on Friday. A bid that's due tomorrow
// hides on /jobs unless you filter just right. This watches every
// pursuing job's bidDueDate and pins the closest deadlines to the
// dashboard so they can't slip past Ryan's morning glance.

import Link from 'next/link';
import type { Job } from '@yge/shared';

interface Props {
  jobs: Job[];
  /** How many days ahead to flag. Default 14. */
  windowDays?: number;
}

interface DueRow {
  job: Job;
  days: number;
}

function daysUntil(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T17:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function BidDueSoonBanner({ jobs, windowDays = 14 }: Props) {
  const now = new Date();
  const flagged: DueRow[] = jobs
    .filter(
      (j) =>
        // Pursuing or prospect — already-submitted jobs don't need the
        // reminder. Same for awarded / lost / archived.
        (j.status === 'PURSUING' || j.status === 'PROSPECT') && j.bidDueDate,
    )
    .map((j) => ({ job: j, days: daysUntil(j.bidDueDate, now) ?? 99 }))
    .filter((r) => r.days <= windowDays)
    .sort((a, b) => a.days - b.days);

  if (flagged.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          Bids due soon ({flagged.length})
        </h2>
        <Link href="/jobs?status=PURSUING" className="text-xs text-amber-900 hover:underline">
          View all pursuing →
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-amber-200/70">
        {flagged.map(({ job, days }) => {
          const tone =
            days < 0
              ? 'text-red-700 font-bold'
              : days <= 1
                ? 'text-red-700 font-bold'
                : days <= 3
                  ? 'text-amber-900 font-semibold'
                  : 'text-amber-900';
          const label =
            days < 0
              ? `${Math.abs(days)} days OVERDUE`
              : days === 0
                ? 'TODAY'
                : days === 1
                  ? 'Tomorrow'
                  : `${days} days`;
          return (
            <li
              key={job.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <Link
                href={`/jobs/${job.id}`}
                className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline"
              >
                {job.projectName}
              </Link>
              <span className={`shrink-0 font-mono text-xs ${tone}`}>
                {job.bidDueDate} · {label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
