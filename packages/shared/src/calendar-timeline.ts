// Cross-job calendar timeline.
//
// Plain English: one chronological list of every dated thing happening
// across YGE — dispatches today, daily reports submitted, SWPPP
// inspections logged, submittal response-due-dates landing, RFI
// response-due-dates landing. Drives the "what's the schedule for
// the rest of this week?" page.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';
import type { SwpppInspection } from './swppp-inspection';

export type TimelineEventKind =
  | 'DISPATCH'
  | 'DAILY_REPORT'
  | 'SWPPP_INSPECTION'
  | 'SUBMITTAL_RESPONSE_DUE'
  | 'RFI_RESPONSE_DUE';

export interface TimelineEvent {
  date: string;
  kind: TimelineEventKind;
  jobId: string;
  /** Display name for the job when caller provides the lookup. */
  projectName: string;
  /** Per-event detail one-liner. */
  detail: string;
  /** Reference id (dispatch / report / submittal / etc.) for deep
   *  linking. */
  refId: string;
}

export interface TimelineDay {
  date: string;
  events: TimelineEvent[];
}

export interface CalendarTimelineReport {
  start: string;
  end: string;
  totalEvents: number;
  byKind: Record<TimelineEventKind, number>;
  days: TimelineDay[];
}

export interface CalendarTimelineInputs {
  start: string;
  end: string;
  dispatches?: Dispatch[];
  dailyReports?: DailyReport[];
  swpppInspections?: SwpppInspection[];
  submittals?: Submittal[];
  rfis?: Rfi[];
  jobNamesById?: Map<string, string>;
}

export function buildCalendarTimeline(
  inputs: CalendarTimelineInputs,
): CalendarTimelineReport {
  const { start, end } = inputs;
  const jobNamesById = inputs.jobNamesById ?? new Map<string, string>();

  const events: TimelineEvent[] = [];

  for (const d of inputs.dispatches ?? []) {
    if (d.scheduledFor < start || d.scheduledFor > end) continue;
    if (d.status === 'CANCELLED' || d.status === 'DRAFT') continue;
    events.push({
      date: d.scheduledFor,
      kind: 'DISPATCH',
      jobId: d.jobId,
      projectName: jobNamesById.get(d.jobId) ?? d.jobId,
      detail: `${d.foremanName}: ${d.scopeOfWork.slice(0, 80)}`,
      refId: d.id,
    });
  }

  for (const dr of inputs.dailyReports ?? []) {
    if (dr.date < start || dr.date > end) continue;
    if (!dr.submitted) continue;
    events.push({
      date: dr.date,
      kind: 'DAILY_REPORT',
      jobId: dr.jobId,
      projectName: jobNamesById.get(dr.jobId) ?? dr.jobId,
      detail: `Daily report by ${dr.foremanId}`,
      refId: dr.id,
    });
  }

  for (const sw of inputs.swpppInspections ?? []) {
    if (sw.inspectedOn < start || sw.inspectedOn > end) continue;
    events.push({
      date: sw.inspectedOn,
      kind: 'SWPPP_INSPECTION',
      jobId: sw.jobId,
      projectName: jobNamesById.get(sw.jobId) ?? sw.jobId,
      detail: `SWPPP inspection (${sw.trigger}) by ${sw.inspectorName}`,
      refId: sw.id,
    });
  }

  for (const s of inputs.submittals ?? []) {
    const due = s.responseDueAt;
    if (!due || due < start || due > end) continue;
    if (s.status !== 'SUBMITTED' && s.status !== 'REVISE_RESUBMIT') continue;
    events.push({
      date: due,
      kind: 'SUBMITTAL_RESPONSE_DUE',
      jobId: s.jobId,
      projectName: jobNamesById.get(s.jobId) ?? s.jobId,
      detail: `Submittal ${s.submittalNumber}: ${s.subject.slice(0, 80)}`,
      refId: s.id,
    });
  }

  for (const r of inputs.rfis ?? []) {
    const due = r.responseDueAt;
    if (!due || due < start || due > end) continue;
    if (r.status !== 'SENT') continue;
    events.push({
      date: due,
      kind: 'RFI_RESPONSE_DUE',
      jobId: r.jobId,
      projectName: jobNamesById.get(r.jobId) ?? r.jobId,
      detail: `RFI ${r.rfiNumber}: ${r.subject.slice(0, 80)}`,
      refId: r.id,
    });
  }

  // Bucket events by date; sort dates asc, events within day by kind
  // then refId for stable order.
  const kindOrder: Record<TimelineEventKind, number> = {
    DISPATCH: 0,
    DAILY_REPORT: 1,
    SWPPP_INSPECTION: 2,
    SUBMITTAL_RESPONSE_DUE: 3,
    RFI_RESPONSE_DUE: 4,
  };
  const byDate = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const days: TimelineDay[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      events: list.sort((a, b) => {
        if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
        return a.refId.localeCompare(b.refId);
      }),
    }));

  const byKind: Record<TimelineEventKind, number> = {
    DISPATCH: 0,
    DAILY_REPORT: 0,
    SWPPP_INSPECTION: 0,
    SUBMITTAL_RESPONSE_DUE: 0,
    RFI_RESPONSE_DUE: 0,
  };
  for (const e of events) byKind[e.kind] += 1;

  return {
    start,
    end,
    totalEvents: events.length,
    byKind,
    days,
  };
}
