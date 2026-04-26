import { describe, expect, it } from 'vitest';
import {
  crewRowViolations,
  crewRowWorkedHours,
  parseHHMM,
  reportViolations,
  totalReportHours,
  type DailyReportCrewRow,
} from './daily-report';

function row(over: Partial<DailyReportCrewRow>): DailyReportCrewRow {
  return {
    employeeId: 'emp-aaaaaaa1',
    startTime: '07:00',
    endTime: '15:30',
    ...over,
  };
}

describe('parseHHMM', () => {
  it('parses HH:MM into minutes-from-midnight', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('07:30')).toBe(450);
    expect(parseHHMM('23:59')).toBe(23 * 60 + 59);
  });

  it('returns null on malformed input', () => {
    expect(parseHHMM('garbage')).toBeNull();
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('07:60')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
    expect(parseHHMM('')).toBeNull();
  });
});

describe('crewRowWorkedHours', () => {
  it('subtracts a logged lunch break', () => {
    const r = row({
      startTime: '07:00',
      endTime: '15:30',
      lunchOut: '11:30',
      lunchIn: '12:00',
    });
    // 8.5 hr clock - 0.5 hr lunch = 8.0 hr
    expect(crewRowWorkedHours(r)).toBe(8.0);
  });

  it('handles a row with no lunch logged', () => {
    const r = row({ startTime: '07:00', endTime: '11:00' });
    expect(crewRowWorkedHours(r)).toBe(4.0);
  });

  it('subtracts both meal breaks on a long shift', () => {
    const r = row({
      startTime: '06:00',
      endTime: '20:00',
      lunchOut: '11:30',
      lunchIn: '12:00',
      secondMealOut: '17:00',
      secondMealIn: '17:30',
    });
    // 14 hr - 1 hr in breaks = 13 hr
    expect(crewRowWorkedHours(r)).toBe(13.0);
  });

  it('returns 0 on garbage times instead of throwing', () => {
    const r = row({ startTime: 'oops', endTime: '15:00' });
    expect(crewRowWorkedHours(r)).toBe(0);
  });
});

describe('crewRowViolations', () => {
  it('flags missing first meal when shift > 5 hr', () => {
    const r = row({ startTime: '07:00', endTime: '13:30' }); // 6.5 hr no lunch
    const v = crewRowViolations(r);
    expect(v).toHaveLength(1);
    expect(v[0]!.kind).toBe('first-meal-missing');
  });

  it('does not flag missing first meal at exactly 5 hours', () => {
    const r = row({ startTime: '07:00', endTime: '12:00' });
    expect(crewRowViolations(r)).toEqual([]);
  });

  it('passes when first meal break is taken (>= 30 min)', () => {
    const r = row({
      startTime: '07:00',
      endTime: '15:30',
      lunchOut: '11:30',
      lunchIn: '12:00',
    });
    expect(crewRowViolations(r)).toEqual([]);
  });

  it('flags missing second meal when shift > 10 hr without it', () => {
    const r = row({
      startTime: '06:00',
      endTime: '18:00',
      lunchOut: '11:00',
      lunchIn: '11:30',
    });
    const v = crewRowViolations(r);
    expect(v.find((x) => x.kind === 'second-meal-missing')).toBeDefined();
  });

  it('passes a 12-hr shift when both meal breaks are taken', () => {
    const r = row({
      startTime: '06:00',
      endTime: '19:00',
      lunchOut: '10:30',
      lunchIn: '11:00',
      secondMealOut: '15:30',
      secondMealIn: '16:00',
    });
    expect(crewRowViolations(r)).toEqual([]);
  });
});

describe('reportViolations / totalReportHours', () => {
  it('aggregates violations across all crew rows', () => {
    const violators = reportViolations({
      crewOnSite: [
        row({ employeeId: 'emp-1', startTime: '07:00', endTime: '13:30' }),
        row({
          employeeId: 'emp-2',
          startTime: '07:00',
          endTime: '15:30',
          lunchOut: '11:30',
          lunchIn: '12:00',
        }),
      ],
    });
    expect(violators).toHaveLength(1);
    expect(violators[0]!.row.employeeId).toBe('emp-1');
  });

  it('respects the per-row waiver note', () => {
    const violators = reportViolations({
      crewOnSite: [
        row({
          employeeId: 'emp-1',
          startTime: '07:00',
          endTime: '13:30',
          mealBreakWaiverNote: 'Employee waived; written waiver on file.',
        }),
      ],
    });
    expect(violators).toEqual([]);
  });

  it('sums total worked hours across the report', () => {
    const total = totalReportHours({
      crewOnSite: [
        row({ employeeId: 'a', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' }),
        row({ employeeId: 'b', startTime: '07:00', endTime: '17:00', lunchOut: '12:00', lunchIn: '12:30' }),
      ],
    });
    // 8 + 9.5 = 17.5
    expect(total).toBe(17.5);
  });
});
