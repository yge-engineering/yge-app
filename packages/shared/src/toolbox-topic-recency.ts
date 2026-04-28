// Per-topic toolbox-talk recency tracker.
//
// Plain English: Cal/OSHA T8 §1509 doesn't mandate which topics
// you cover at the weekly tailgate — but you want the rotation
// to actually rotate. If "trenching safety" hasn't been covered
// in 6 months on a job that excavates daily, that's a coaching
// gap and a liability gap.
//
// Walks held/submitted toolbox talks and groups by canonical
// topic. Per topic:
//   - times covered in window
//   - first / last held date
//   - days since last covered (vs asOf)
//   - average attendees per session
//   - tier flag based on days-since: FRESH / DUE_SOON / STALE / COLD
//
// Different from toolbox-compliance (per-job cadence) and
// toolbox-attendance-gap (per-employee attendance). This is the
// per-topic curriculum view.
//
// Pure derivation. No persisted records.

import type { ToolboxTalk } from './toolbox-talk';

export type TopicRecencyFlag =
  | 'FRESH'      // covered in the last 30 days
  | 'DUE_SOON'   // 30-60 days since
  | 'STALE'      // 60-120 days since
  | 'COLD';      // 120+ days since

export interface ToolboxTopicRecencyRow {
  topic: string;
  /** Original topic string (preserves casing of the most-recent session). */
  topicDisplay: string;
  sessionCount: number;
  firstHeldOn: string;
  lastHeldOn: string;
  daysSinceLastHeld: number;
  /** Total attendees summed across sessions. */
  totalAttendees: number;
  /** sessionCount > 0 ? totalAttendees / sessionCount : 0. Decimal-1. */
  avgAttendees: number;
  flag: TopicRecencyFlag;
}

export interface ToolboxTopicRecencyRollup {
  topicsConsidered: number;
  totalSessions: number;
  totalAttendees: number;
  fresh: number;
  dueSoon: number;
  stale: number;
  cold: number;
}

export interface ToolboxTopicRecencyInputs {
  talks: ToolboxTalk[];
  /** asOf yyyy-mm-dd for "days since" math. Defaults to the latest
   *  heldOn observed; falls back to '1970-01-01'. */
  asOf?: string;
  /** Inclusive yyyy-mm-dd lower bound on heldOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildToolboxTopicRecency(
  inputs: ToolboxTopicRecencyInputs,
): {
  rollup: ToolboxTopicRecencyRollup;
  rows: ToolboxTopicRecencyRow[];
} {
  // Filter to held/submitted in window. DRAFT talks haven't actually
  // happened.
  const talks = inputs.talks
    .filter((t) => t.status === 'HELD' || t.status === 'SUBMITTED')
    .filter((t) => !inputs.fromDate || t.heldOn >= inputs.fromDate)
    .filter((t) => !inputs.toDate || t.heldOn <= inputs.toDate);

  // asOf default = latest heldOn.
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const t of talks) {
      if (t.heldOn > latest) latest = t.heldOn;
    }
    asOf = latest || '1970-01-01';
  }

  // Bucket by canonical topic.
  type Bucket = {
    canonical: string;
    display: string;
    talks: ToolboxTalk[];
    firstHeld: string;
    lastHeld: string;
    attendeeTotal: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const t of talks) {
    const key = canonicalize(t.topic);
    const b = buckets.get(key) ?? {
      canonical: key,
      display: t.topic,
      talks: [],
      firstHeld: '',
      lastHeld: '',
      attendeeTotal: 0,
    };
    b.talks.push(t);
    b.attendeeTotal += t.attendees.length;
    if (b.firstHeld === '' || t.heldOn < b.firstHeld) b.firstHeld = t.heldOn;
    if (t.heldOn > b.lastHeld) {
      b.lastHeld = t.heldOn;
      b.display = t.topic; // most-recent casing wins
    }
    buckets.set(key, b);
  }

  let fresh = 0;
  let dueSoon = 0;
  let stale = 0;
  let cold = 0;
  let totalSessions = 0;
  let totalAttendees = 0;

  const rows: ToolboxTopicRecencyRow[] = [];
  for (const b of buckets.values()) {
    const days = daysBetween(b.lastHeld, asOf);
    const flag = scoreFlag(days);
    const sessionCount = b.talks.length;
    const avg = sessionCount === 0 ? 0 : Math.round((b.attendeeTotal / sessionCount) * 10) / 10;

    rows.push({
      topic: b.canonical,
      topicDisplay: b.display,
      sessionCount,
      firstHeldOn: b.firstHeld,
      lastHeldOn: b.lastHeld,
      daysSinceLastHeld: days,
      totalAttendees: b.attendeeTotal,
      avgAttendees: avg,
      flag,
    });

    totalSessions += sessionCount;
    totalAttendees += b.attendeeTotal;
    if (flag === 'FRESH') fresh += 1;
    else if (flag === 'DUE_SOON') dueSoon += 1;
    else if (flag === 'STALE') stale += 1;
    else cold += 1;
  }

  // Sort: coldest topics first (highest daysSinceLastHeld), then by
  // sessionCount asc (less-frequently-covered topics surface).
  rows.sort((a, b) => {
    if (a.daysSinceLastHeld !== b.daysSinceLastHeld) {
      return b.daysSinceLastHeld - a.daysSinceLastHeld;
    }
    return a.sessionCount - b.sessionCount;
  });

  return {
    rollup: {
      topicsConsidered: rows.length,
      totalSessions,
      totalAttendees,
      fresh,
      dueSoon,
      stale,
      cold,
    },
    rows,
  };
}

function canonicalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreFlag(daysSince: number): TopicRecencyFlag {
  if (daysSince <= 30) return 'FRESH';
  if (daysSince <= 60) return 'DUE_SOON';
  if (daysSince <= 120) return 'STALE';
  return 'COLD';
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
