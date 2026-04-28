// Daily RFI submission + answer volume.
//
// Plain English: per day in window, how many RFIs went out and
// how many came back? When the submitted count keeps outpacing
// the answered count, the backlog is growing — agency engineer
// is overwhelmed or YGE's RFIs are getting harder to answer.
// Walking the day-by-day shape catches the trend before the
// monthly meeting.
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface DailyRfiVolumeRow {
  date: string;
  submittedCount: number;
  answeredCount: number;
  netCount: number;
  cumulativeBacklog: number;
}

export interface DailyRfiVolumeRollup {
  daysWithActivity: number;
  totalSubmitted: number;
  totalAnswered: number;
  netBacklogChange: number;
  /** Highest single-day cumulative backlog. */
  peakBacklog: number;
  peakBacklogDate: string | null;
}

export interface DailyRfiVolumeInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  rfis: Rfi[];
  /** Starting backlog at fromDate (defaults to 0). */
  openingBacklog?: number;
}

export function buildDailyRfiVolume(inputs: DailyRfiVolumeInputs): {
  rollup: DailyRfiVolumeRollup;
  rows: DailyRfiVolumeRow[];
} {
  type Bucket = {
    date: string;
    submitted: number;
    answered: number;
  };
  const buckets = new Map<string, Bucket>();

  const inWindow = (d: string) =>
    d >= inputs.fromDate && d <= inputs.toDate;

  for (const r of inputs.rfis) {
    if (r.sentAt && inWindow(r.sentAt)) {
      const b = buckets.get(r.sentAt) ?? {
        date: r.sentAt,
        submitted: 0,
        answered: 0,
      };
      b.submitted += 1;
      buckets.set(r.sentAt, b);
    }
    if (r.answeredAt && inWindow(r.answeredAt)) {
      const day = r.answeredAt.slice(0, 10);
      const b = buckets.get(day) ?? {
        date: day,
        submitted: 0,
        answered: 0,
      };
      b.answered += 1;
      buckets.set(day, b);
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const rows: DailyRfiVolumeRow[] = [];
  let totalSubmitted = 0;
  let totalAnswered = 0;
  let running = inputs.openingBacklog ?? 0;
  let peak = running;
  let peakDate: string | null = null;

  for (const b of sorted) {
    const net = b.submitted - b.answered;
    running += net;
    rows.push({
      date: b.date,
      submittedCount: b.submitted,
      answeredCount: b.answered,
      netCount: net,
      cumulativeBacklog: running,
    });
    totalSubmitted += b.submitted;
    totalAnswered += b.answered;
    if (running > peak || peakDate === null) {
      peak = running;
      peakDate = b.date;
    }
  }

  return {
    rollup: {
      daysWithActivity: rows.length,
      totalSubmitted,
      totalAnswered,
      netBacklogChange: totalSubmitted - totalAnswered,
      peakBacklog: peak,
      peakBacklogDate: peakDate,
    },
    rows,
  };
}
