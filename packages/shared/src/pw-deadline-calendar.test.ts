import { describe, it, expect } from 'vitest';
import {
  PwAwardedJobSchema,
  actionableRows,
  buildPwCalendar,
} from './pw-deadline-calendar';

function job(over: Partial<Parameters<typeof PwAwardedJobSchema.parse>[0]> = {}) {
  return PwAwardedJobSchema.parse({
    id: 'job-1',
    projectName: 'Sulphur Springs Soquol Rd',
    awardDate: '2026-05-15',
    crafts: ['Operating Engineer'],
    cprStarted: false,
    ...over,
  });
}

describe('buildPwCalendar — DAS_140', () => {
  it('emits one row per craft, 10 calendar days from award', () => {
    const j = job({ crafts: ['Operating Engineer', 'Laborer'] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-20' });
    const das = rows.filter((r) => r.kind === 'DAS_140');
    expect(das).toHaveLength(2);
    expect(das.every((r) => r.dueDate === '2026-05-25')).toBe(true);
  });

  it('marks PAST when due date is before asOfDate', () => {
    const j = job({ awardDate: '2026-04-01', crafts: ['Operating Engineer'] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-22' });
    const das = rows.find((r) => r.kind === 'DAS_140')!;
    expect(das.status).toBe('PAST');
    expect(das.daysUntilDue).toBeLessThan(0);
  });

  it('marks URGENT inside the default 3-day window', () => {
    // Award 2026-05-15 → DAS-140 due 2026-05-25 → 3 days from 2026-05-22.
    const j = job({ awardDate: '2026-05-15', crafts: ['Operating Engineer'] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-22' });
    const das = rows.find((r) => r.kind === 'DAS_140')!;
    expect(das.status).toBe('URGENT');
    expect(das.daysUntilDue).toBe(3);
  });

  it('marks UPCOMING when further than urgent window', () => {
    const j = job({ awardDate: '2026-05-15', crafts: ['Operating Engineer'] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-18' });
    const das = rows.find((r) => r.kind === 'DAS_140')!;
    expect(das.status).toBe('UPCOMING');
    expect(das.daysUntilDue).toBe(7);
  });

  it('caller can tighten the urgent window', () => {
    const j = job({ awardDate: '2026-05-15', crafts: ['Operating Engineer'] });
    const rows = buildPwCalendar({
      jobs: [j],
      asOfDate: '2026-05-18',
      urgentWithinDays: 10,
    });
    const das = rows.find((r) => r.kind === 'DAS_140')!;
    expect(das.status).toBe('URGENT');
  });
});

describe('buildPwCalendar — PWC_100', () => {
  it('emits one row per job, 5 business days from award', () => {
    // 2026-05-15 = Friday. +5 business days = Mon, Tue, Wed, Thu, Fri = 2026-05-22.
    const j = job({ awardDate: '2026-05-15', crafts: [] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-15' });
    const pwc = rows.find((r) => r.kind === 'PWC_100');
    expect(pwc).toBeDefined();
    expect(pwc!.dueDate).toBe('2026-05-22');
  });

  it('PWC-100 skips weekends', () => {
    // 2026-05-13 = Wed. +5 business days = Thu, Fri, Mon, Tue, Wed = 2026-05-20.
    const j = job({ awardDate: '2026-05-13', crafts: [] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-13' });
    const pwc = rows.find((r) => r.kind === 'PWC_100')!;
    expect(pwc.dueDate).toBe('2026-05-20');
  });

  it('PWC-100 skips CA holidays too (Memorial Day)', () => {
    // 2026-05-22 = Fri. +5 business days must SKIP Memorial Day
    // (2026-05-25 Mon). So Tue/Wed/Thu/Fri/Mon → 2026-06-01.
    // Before bundle 2552 the local helper only skipped weekends and
    // would have returned 2026-05-29. This test pins the holiday-aware
    // behavior so it can't regress.
    const j = job({ awardDate: '2026-05-22', crafts: [] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-22' });
    const pwc = rows.find((r) => r.kind === 'PWC_100')!;
    expect(pwc.dueDate).toBe('2026-06-01');
  });
});

describe('buildPwCalendar — CPR_WEEKLY', () => {
  it('emits only when cprStarted = true', () => {
    const off = job({ cprStarted: false });
    const on = job({ id: 'job-2', cprStarted: true });
    const rows = buildPwCalendar({ jobs: [off, on], asOfDate: '2026-05-20' });
    const cpr = rows.filter((r) => r.kind === 'CPR_WEEKLY');
    expect(cpr).toHaveLength(1);
    expect(cpr[0]!.jobId).toBe('job-2');
  });

  it('next Sunday from a Wednesday is the next Sunday', () => {
    // 2026-05-20 is Wednesday → next Sunday is 2026-05-24.
    const j = job({ cprStarted: true });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-20' });
    const cpr = rows.find((r) => r.kind === 'CPR_WEEKLY')!;
    expect(cpr.dueDate).toBe('2026-05-24');
  });

  it('today is Sunday → due today', () => {
    // 2026-05-24 is Sunday.
    const j = job({ cprStarted: true });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-24' });
    const cpr = rows.find((r) => r.kind === 'CPR_WEEKLY')!;
    expect(cpr.dueDate).toBe('2026-05-24');
    expect(cpr.daysUntilDue).toBe(0);
  });
});

describe('buildPwCalendar — sort', () => {
  it('PAST rows come before URGENT, URGENT before UPCOMING', () => {
    const oldAward = job({ id: 'a', awardDate: '2026-04-01' });
    const newAward = job({ id: 'b', awardDate: '2026-05-15' });
    const rows = buildPwCalendar({ jobs: [oldAward, newAward], asOfDate: '2026-05-22' });
    const statuses = rows.map((r) => r.status);
    // PAST first, then URGENT/UPCOMING.
    const firstPast = statuses.indexOf('PAST');
    const firstUrgent = statuses.indexOf('URGENT');
    const firstUpcoming = statuses.indexOf('UPCOMING');
    if (firstUrgent >= 0 && firstPast >= 0) expect(firstPast).toBeLessThan(firstUrgent);
    if (firstUpcoming >= 0 && firstUrgent >= 0) expect(firstUrgent).toBeLessThan(firstUpcoming);
  });
});

describe('actionableRows', () => {
  it('filters out UPCOMING rows', () => {
    const j = job({ awardDate: '2026-05-15', crafts: ['Op Eng'] });
    const rows = buildPwCalendar({ jobs: [j], asOfDate: '2026-05-18' });
    const actionable = actionableRows(rows);
    expect(actionable.every((r) => r.status !== 'UPCOMING')).toBe(true);
  });
});
