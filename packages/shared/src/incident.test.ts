import { describe, expect, it } from 'vitest';
import {
  computeForm300A,
  computeIncidentRollup,
  isSeriousReportable,
  type Incident,
} from './incident';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-01',
    employeeName: 'Jane Doe',
    location: 'Sta. 12+50',
    description: 'Strained shoulder lifting form panel',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    calOshaReported: false,
    status: 'OPEN',
    ...over,
  };
}

describe('computeForm300A', () => {
  it('only counts incidents from the requested year', () => {
    const r = computeForm300A(
      [
        inc({ id: 'inc-11111111', logYear: 2026, outcome: 'DAYS_AWAY', daysAway: 3 }),
        inc({ id: 'inc-22222222', logYear: 2025, outcome: 'DAYS_AWAY', daysAway: 99 }),
      ],
      2026,
    );
    expect(r.totalCases).toBe(1);
    expect(r.totalDaysAway).toBe(3);
  });

  it('rolls up cases by outcome + classification', () => {
    const r = computeForm300A(
      [
        inc({ id: 'inc-11111111', outcome: 'DAYS_AWAY', daysAway: 5, classification: 'INJURY' }),
        inc({ id: 'inc-22222222', outcome: 'JOB_TRANSFER_OR_RESTRICTION', daysRestricted: 2, classification: 'SKIN_DISORDER' }),
        inc({ id: 'inc-33333333', outcome: 'DEATH', died: true, classification: 'INJURY' }),
        inc({ id: 'inc-44444444', outcome: 'OTHER_RECORDABLE', classification: 'HEARING_LOSS' }),
      ],
      2026,
    );
    expect(r.totalCases).toBe(4);
    expect(r.totalDeaths).toBe(1);
    expect(r.totalDaysAwayCases).toBe(1);
    expect(r.totalRestrictedCases).toBe(1);
    expect(r.totalOtherRecordableCases).toBe(1);
    expect(r.totalDaysAway).toBe(5);
    expect(r.totalDaysRestricted).toBe(2);
    expect(r.byClassification.injuries).toBe(2);
    expect(r.byClassification.skinDisorders).toBe(1);
    expect(r.byClassification.hearingLoss).toBe(1);
  });
});

describe('isSeriousReportable', () => {
  it('flags deaths, hospitalizations, and DEATH outcome', () => {
    expect(isSeriousReportable(inc({ died: true }))).toBe(true);
    expect(isSeriousReportable(inc({ hospitalizedOvernight: true }))).toBe(true);
    expect(isSeriousReportable(inc({ outcome: 'DEATH' }))).toBe(true);
    expect(isSeriousReportable(inc({}))).toBe(false);
  });
});

describe('computeIncidentRollup', () => {
  it('counts unreported serious cases', () => {
    const r = computeIncidentRollup(
      [
        inc({ id: 'inc-11111111', died: true, calOshaReported: false }),
        inc({ id: 'inc-22222222', hospitalizedOvernight: true, calOshaReported: true }),
        inc({ id: 'inc-33333333' }),
      ],
      new Date('2026-04-15T00:00:00Z'),
    );
    expect(r.unreportedSerious).toBe(1);
  });
});
