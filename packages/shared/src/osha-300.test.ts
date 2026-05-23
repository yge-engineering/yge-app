import { describe, it, expect } from 'vitest';
import {
  buildOsha300Rows,
  buildOsha300ASummary,
  incidentsForLogYear,
  illnessColumnFor,
  osha300CsvRows,
} from './osha-300';
import { IncidentSchema, type Incident } from './incident';

// Use IncidentSchema.parse so missing optional / default-bearing fields get
// filled in automatically — avoids hand-listing every required field.
function inc(over: Record<string, unknown> = {}): Incident {
  return IncidentSchema.parse({
    id: 'inc-12345678',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-03-15',
    employeeName: 'Ryan Young',
    jobTitle: 'Operator',
    location: 'Sulphur Springs',
    description: 'Slip on hose',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    status: 'OPEN',
    ...over,
  });
}

describe('incidentsForLogYear', () => {
  it('filters by year of incidentDate', () => {
    const xs = [
      inc({ incidentDate: '2025-12-31' }),
      inc({ incidentDate: '2026-01-01' }),
      inc({ incidentDate: '2026-12-31' }),
      inc({ incidentDate: '2027-01-01' }),
    ];
    expect(incidentsForLogYear(xs, 2026)).toHaveLength(2);
  });
});

describe('illnessColumnFor', () => {
  it('round-trips each classification', () => {
    expect(illnessColumnFor('INJURY')).toBe('INJURY');
    expect(illnessColumnFor('SKIN_DISORDER')).toBe('SKIN_DISORDER');
    expect(illnessColumnFor('RESPIRATORY')).toBe('RESPIRATORY');
    expect(illnessColumnFor('POISONING')).toBe('POISONING');
    expect(illnessColumnFor('HEARING_LOSS')).toBe('HEARING_LOSS');
    expect(illnessColumnFor('OTHER_ILLNESS')).toBe('OTHER_ILLNESS');
  });
});

describe('buildOsha300Rows', () => {
  it('honors the §1904.29(b)(7) privacy-case rule (name → "Privacy Case")', () => {
    const rows = buildOsha300Rows(
      [inc({ employeeName: 'Jane Doe', privacyCase: true })],
      2026,
    );
    expect(rows[0]?.employeeName).toBe('Privacy Case');
  });

  it('sorts by case number numerically', () => {
    const xs = [
      inc({ caseNumber: '2026-002' }),
      inc({ caseNumber: '2026-001' }),
      inc({ caseNumber: '2026-010' }),
    ];
    const rows = buildOsha300Rows(xs, 2026);
    expect(rows.map((r) => r.caseNumber)).toEqual(['2026-001', '2026-002', '2026-010']);
  });

  it('omits incidents from other years', () => {
    const xs = [
      inc({ incidentDate: '2025-10-01', caseNumber: '2025-005' }),
      inc({ incidentDate: '2026-04-01', caseNumber: '2026-001' }),
    ];
    const rows = buildOsha300Rows(xs, 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.caseNumber).toBe('2026-001');
  });
});

describe('buildOsha300ASummary', () => {
  it('counts cases by outcome and classification', () => {
    const xs = [
      inc({ caseNumber: '2026-001', classification: 'INJURY', outcome: 'DAYS_AWAY', daysAway: 5 }),
      inc({ caseNumber: '2026-002', classification: 'INJURY', outcome: 'JOB_TRANSFER_OR_RESTRICTION', daysRestricted: 3 }),
      inc({ caseNumber: '2026-003', classification: 'HEARING_LOSS', outcome: 'OTHER_RECORDABLE' }),
      inc({ caseNumber: '2026-004', classification: 'INJURY', outcome: 'DEATH', died: true }),
    ];
    const sum = buildOsha300ASummary(xs, 2026);
    expect(sum.logYear).toBe(2026);
    expect(sum.totalCases).toBe(4);
    expect(sum.byOutcome.DEATH).toBe(1);
    expect(sum.byOutcome.DAYS_AWAY).toBe(1);
    expect(sum.byOutcome.JOB_TRANSFER_OR_RESTRICTION).toBe(1);
    expect(sum.byOutcome.OTHER_RECORDABLE).toBe(1);
    expect(sum.byClassification.INJURY).toBe(3);
    expect(sum.byClassification.HEARING_LOSS).toBe(1);
    expect(sum.totalDaysAway).toBe(5);
    expect(sum.totalDaysRestricted).toBe(3);
  });

  it('returns zero summary when no cases in year', () => {
    const sum = buildOsha300ASummary([inc({ incidentDate: '2025-05-05' })], 2026);
    expect(sum.totalCases).toBe(0);
    expect(sum.totalDaysAway).toBe(0);
    expect(sum.byOutcome.DEATH).toBe(0);
  });
});

describe('osha300CsvRows', () => {
  it('produces headers + rows in expected shape', () => {
    const rows = buildOsha300Rows([inc()], 2026);
    const csv = osha300CsvRows(rows);
    expect(csv.headers[0]).toBe('Case #');
    expect(csv.rows).toHaveLength(1);
    expect(csv.rows[0]?.[0]).toBe('2026-001');
  });
});
