import { describe, expect, it } from 'vitest';
import { buildCprGapReport } from './cpr-gap-detector';
import type { CertifiedPayroll } from './certified-payroll';
import type { TimeCard, TimeEntry } from './time-card';

function cpr(over: Partial<CertifiedPayroll>): CertifiedPayroll {
  return {
    id: 'cpr-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    payrollNumber: 1,
    isFinalPayroll: false,
    weekStarting: '2026-04-06',
    weekEnding: '2026-04-12',
    status: 'SUBMITTED',
    rows: [],
    complianceStatementSigned: true,
    ...over,
  } as CertifiedPayroll;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
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

describe('buildCprGapReport', () => {
  it('clean job has no gaps', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', payrollNumber: 2, weekStarting: '2026-04-13' }),
        cpr({ id: 'c', payrollNumber: 3, weekStarting: '2026-04-20' }),
      ],
    });
    expect(r.totalGaps).toBe(0);
    expect(r.jobs[0]?.clean).toBe(true);
  });

  it('flags WEEK_GAP when middle week missing', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', payrollNumber: 1, weekStarting: '2026-04-06' }),
        // Missing: 2026-04-13
        cpr({ id: 'c', payrollNumber: 3, weekStarting: '2026-04-20' }),
      ],
    });
    const job = r.jobs[0]!;
    expect(job.gaps.some((g) => g.reason === 'WEEK_GAP' && g.weekStarting === '2026-04-13')).toBe(true);
  });

  it('flags NUMBER_OUT_OF_SEQUENCE on a payrollNumber jump', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', payrollNumber: 2, weekStarting: '2026-04-13' }),
        cpr({ id: 'd', payrollNumber: 5, weekStarting: '2026-04-20' }),
      ],
    });
    const job = r.jobs[0]!;
    expect(
      job.gaps.some(
        (g) => g.reason === 'NUMBER_OUT_OF_SEQUENCE' && g.weekStarting === '2026-04-20',
      ),
    ).toBe(true);
  });

  it('flags TIME_CARDS_NO_CPR when hours exist but no CPR is on file', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [],
      timeCards: [
        card('emp-1', '2026-04-13', [
          entry({ date: '2026-04-13', jobId: 'job-1' }),
          entry({ date: '2026-04-14', jobId: 'job-1' }),
        ]),
      ],
    });
    expect(r.jobs[0]?.jobId).toBe('job-1');
    expect(r.jobs[0]?.gaps[0]?.reason).toBe('TIME_CARDS_NO_CPR');
  });

  it('skips DRAFT CPRs', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', status: 'DRAFT', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', status: 'ACCEPTED', payrollNumber: 2, weekStarting: '2026-04-13' }),
        cpr({ id: 'c', status: 'SUBMITTED', payrollNumber: 3, weekStarting: '2026-04-20' }),
      ],
    });
    expect(r.jobs[0]?.cprsFiled).toBe(2);
  });

  it('jobId filter restricts the audit', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      jobId: 'job-A',
      certifiedPayrolls: [
        cpr({ id: 'a', jobId: 'job-A', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', jobId: 'job-B', payrollNumber: 1, weekStarting: '2026-04-06' }),
      ],
    });
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]?.jobId).toBe('job-A');
  });

  it('does not double-flag a missing week that is already TIME_CARDS_NO_CPR', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', payrollNumber: 3, weekStarting: '2026-04-20' }),
      ],
      timeCards: [
        card('emp-1', '2026-04-13', [entry({ date: '2026-04-13', jobId: 'job-1' })]),
      ],
    });
    const job = r.jobs[0]!;
    const week13Gaps = job.gaps.filter((g) => g.weekStarting === '2026-04-13');
    expect(week13Gaps).toHaveLength(1);
    expect(week13Gaps[0]?.reason).toBe('TIME_CARDS_NO_CPR');
  });

  it('totals + clean flag', () => {
    const r = buildCprGapReport({
      asOf: '2026-04-27',
      certifiedPayrolls: [
        cpr({ id: 'a', jobId: 'job-clean', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'b', jobId: 'job-clean', payrollNumber: 2, weekStarting: '2026-04-13' }),
        cpr({ id: 'c', jobId: 'job-bad', payrollNumber: 1, weekStarting: '2026-04-06' }),
        cpr({ id: 'd', jobId: 'job-bad', payrollNumber: 5, weekStarting: '2026-04-13' }),
      ],
    });
    expect(r.totalGaps).toBe(1); // one out-of-sequence on job-bad
    expect(r.jobs[0]?.jobId).toBe('job-bad'); // worst-first sort
    expect(r.jobs[1]?.clean).toBe(true);
  });
});
