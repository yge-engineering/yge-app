import { describe, expect, it } from 'vitest';
import { buildOvertimeExposure } from './overtime-exposure';
import type { TimeCard, TimeEntry } from './time-card';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-13',
    jobId: 'job-1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as TimeEntry;
}

function card(employeeId: string, weekStarting: string, entries: Partial<TimeEntry>[]): TimeCard {
  return {
    id: `tc-${employeeId}-${weekStarting}`,
    createdAt: '',
    updatedAt: '',
    employeeId,
    weekStarting,
    entries: entries.map((e) => entry(e)),
    status: 'APPROVED',
  } as TimeCard;
}

describe('buildOvertimeExposure', () => {
  it('OK at 40 hours, no OT', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        card('emp-1', '2026-04-13', [
          entry({ date: '2026-04-13' }),
          entry({ date: '2026-04-14' }),
          entry({ date: '2026-04-15' }),
          entry({ date: '2026-04-16' }),
          entry({ date: '2026-04-17' }),
        ]),
      ],
    });
    const row = r.byEmployee[0]!;
    expect(row.regularHours).toBe(40);
    expect(row.totalOtHours).toBe(0);
    expect(row.worstFlag).toBe('OK');
  });

  it('ELEVATED at >50 hours, HIGH at >60, EXTREME at >70', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        // 5 × 12 hrs = 60 → ELEVATED (>50)
        card('elev', '2026-04-13', [
          entry({ date: '2026-04-13', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-14', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-15', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-16', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-17', startTime: '06:00', endTime: '17:00' }),
        ]),
        // 6 × 12 hrs = 72 → EXTREME (>70)
        card('ext', '2026-04-13', [
          entry({ date: '2026-04-13', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-14', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-15', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-16', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-17', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-18', startTime: '06:00', endTime: '18:00' }),
        ]),
      ],
    });
    const elev = r.byEmployee.find((x) => x.employeeId === 'elev')!;
    expect(elev.totalHours).toBe(55);
    expect(elev.worstFlag).toBe('ELEVATED');
    const ext = r.byEmployee.find((x) => x.employeeId === 'ext')!;
    expect(ext.totalHours).toBe(72);
    expect(ext.worstFlag).toBe('EXTREME');
  });

  it('skips DRAFT cards', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        {
          ...card('emp-1', '2026-04-13', [entry({ date: '2026-04-13' })]),
          status: 'DRAFT',
        },
      ],
    });
    expect(r.byEmployee).toHaveLength(0);
  });

  it('honors window via weekStarting', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        card('emp-1', '2026-04-06', [entry({ date: '2026-04-06' })]), // out
        card('emp-1', '2026-04-13', [entry({ date: '2026-04-13' })]),
      ],
    });
    expect(r.byEmployee[0]?.weeksReported).toBe(1);
  });

  it('aggregates multiple cards per employee', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-01',
      end: '2026-04-30',
      timeCards: [
        card('emp-1', '2026-04-06', [entry({ date: '2026-04-06' })]),
        card('emp-1', '2026-04-13', [entry({ date: '2026-04-13' })]),
        card('emp-1', '2026-04-20', [entry({ date: '2026-04-20' })]),
      ],
    });
    const row = r.byEmployee[0]!;
    expect(row.weeksReported).toBe(3);
    expect(row.totalHours).toBe(24); // 3 days × 8 hours
  });

  it('totalOvertimePremiumHours = 0.5 × total OT hours', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        card('emp-1', '2026-04-13', [
          // 5 × 10 hrs = 50 total. 5 × (10-8) = 10 daily OT.
          entry({ date: '2026-04-13', startTime: '07:00', endTime: '17:00' }),
          entry({ date: '2026-04-14', startTime: '07:00', endTime: '17:00' }),
          entry({ date: '2026-04-15', startTime: '07:00', endTime: '17:00' }),
          entry({ date: '2026-04-16', startTime: '07:00', endTime: '17:00' }),
          entry({ date: '2026-04-17', startTime: '07:00', endTime: '17:00' }),
        ]),
      ],
    });
    expect(r.totalOtHours).toBe(10);
    expect(r.totalOvertimePremiumHours).toBe(5);
  });

  it('sorts EXTREME first, then HIGH, then ELEVATED, OK last', () => {
    const r = buildOvertimeExposure({
      start: '2026-04-13',
      end: '2026-04-19',
      timeCards: [
        card('ok', '2026-04-13', [entry({ date: '2026-04-13' })]),
        card('extreme', '2026-04-13', [
          entry({ date: '2026-04-13', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-14', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-15', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-16', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-17', startTime: '06:00', endTime: '18:00' }),
          entry({ date: '2026-04-18', startTime: '06:00', endTime: '18:00' }),
        ]),
        card('elev', '2026-04-13', [
          entry({ date: '2026-04-13', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-14', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-15', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-16', startTime: '06:00', endTime: '17:00' }),
          entry({ date: '2026-04-17', startTime: '06:00', endTime: '17:00' }),
        ]),
      ],
    });
    expect(r.byEmployee.map((x) => x.employeeId)).toEqual(['extreme', 'elev', 'ok']);
  });
});
