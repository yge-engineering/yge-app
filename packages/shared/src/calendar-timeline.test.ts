import { describe, expect, it } from 'vitest';
import { buildCalendarTimeline } from './calendar-timeline';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';
import type { SwpppInspection } from './swppp-inspection';

function dispatch(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    scheduledFor: '2026-04-15',
    foremanName: 'Bob',
    scopeOfWork: 'Set forms',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function sw(over: Partial<SwpppInspection>): SwpppInspection {
  return {
    id: 'swp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    inspectedOn: '2026-04-15',
    trigger: 'WEEKLY',
    inspectorName: 'Ryan',
    rainForecast: false,
    qualifyingRainEvent: false,
    dischargeOccurred: false,
    bmpChecks: [],
    ...over,
  } as SwpppInspection;
}

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    submittalNumber: 'S-1',
    subject: 'Rebar shop drawings',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    responseDueAt: '2026-04-20',
    ...over,
  } as Submittal;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    rfiNumber: 'RFI-001',
    subject: 'Question',
    question: '',
    status: 'SENT',
    priority: 'MEDIUM',
    costImpact: false,
    scheduleImpact: false,
    responseDueAt: '2026-04-22',
    ...over,
  } as Rfi;
}

describe('buildCalendarTimeline', () => {
  it('combines all kinds into chronological days', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-13',
      end: '2026-04-30',
      dispatches: [dispatch({ scheduledFor: '2026-04-15' })],
      dailyReports: [dr({ date: '2026-04-15' })],
      swpppInspections: [sw({ inspectedOn: '2026-04-17' })],
      submittals: [sub({ responseDueAt: '2026-04-20' })],
      rfis: [rfi({ responseDueAt: '2026-04-22' })],
    });
    expect(r.totalEvents).toBe(5);
    expect(r.byKind.DISPATCH).toBe(1);
    expect(r.byKind.DAILY_REPORT).toBe(1);
    expect(r.byKind.SWPPP_INSPECTION).toBe(1);
    expect(r.byKind.SUBMITTAL_RESPONSE_DUE).toBe(1);
    expect(r.byKind.RFI_RESPONSE_DUE).toBe(1);
  });

  it('skips events outside the window', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-15',
      dispatches: [
        dispatch({ id: 'in', scheduledFor: '2026-04-15' }),
        dispatch({ id: 'before', scheduledFor: '2026-04-01' }),
        dispatch({ id: 'after', scheduledFor: '2026-04-30' }),
      ],
    });
    expect(r.totalEvents).toBe(1);
  });

  it('filters CANCELLED + DRAFT dispatches', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-15',
      dispatches: [
        dispatch({ id: 'a', status: 'POSTED' }),
        dispatch({ id: 'b', status: 'COMPLETED' }),
        dispatch({ id: 'c', status: 'CANCELLED' }),
        dispatch({ id: 'd', status: 'DRAFT' }),
      ],
    });
    expect(r.byKind.DISPATCH).toBe(2);
  });

  it('skips unsubmitted daily reports', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-15',
      dailyReports: [
        dr({ id: 'a', submitted: true }),
        dr({ id: 'b', submitted: false }),
      ],
    });
    expect(r.byKind.DAILY_REPORT).toBe(1);
  });

  it('only flows submittals in SUBMITTED or REVISE_RESUBMIT', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-25',
      submittals: [
        sub({ id: '1', status: 'SUBMITTED', responseDueAt: '2026-04-20' }),
        sub({ id: '2', status: 'REVISE_RESUBMIT', responseDueAt: '2026-04-21' }),
        sub({ id: '3', status: 'APPROVED', responseDueAt: '2026-04-22' }),
        sub({ id: '4', status: 'DRAFT', responseDueAt: '2026-04-23' }),
      ],
    });
    expect(r.byKind.SUBMITTAL_RESPONSE_DUE).toBe(2);
  });

  it('only flows RFIs in SENT', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-25',
      rfis: [
        rfi({ id: '1', status: 'SENT', responseDueAt: '2026-04-20' }),
        rfi({ id: '2', status: 'ANSWERED', responseDueAt: '2026-04-21' }),
        rfi({ id: '3', status: 'DRAFT', responseDueAt: '2026-04-22' }),
      ],
    });
    expect(r.byKind.RFI_RESPONSE_DUE).toBe(1);
  });

  it('groups events by date in chronological order', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-13',
      end: '2026-04-30',
      dispatches: [
        dispatch({ id: 'a', scheduledFor: '2026-04-20' }),
        dispatch({ id: 'b', scheduledFor: '2026-04-15' }),
      ],
      submittals: [sub({ responseDueAt: '2026-04-20' })],
    });
    expect(r.days.map((d) => d.date)).toEqual(['2026-04-15', '2026-04-20']);
    expect(r.days[1]?.events).toHaveLength(2);
  });

  it('uses jobNamesById for friendly names', () => {
    const r = buildCalendarTimeline({
      start: '2026-04-15',
      end: '2026-04-15',
      dispatches: [dispatch({ jobId: 'job-foo' })],
      jobNamesById: new Map([['job-foo', 'Sulphur Springs']]),
    });
    expect(r.days[0]?.events[0]?.projectName).toBe('Sulphur Springs');
  });
});
