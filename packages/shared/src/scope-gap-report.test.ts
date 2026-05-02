import { describe, expect, it } from 'vitest';
import {
  ScopeGapReportSchema,
  computeScopeGapRollup,
  sortGaps,
  type ScopeGap,
} from './scope-gap-report';

describe('ScopeGapReportSchema', () => {
  it('rejects an unknown overallStatus', () => {
    expect(() =>
      ScopeGapReportSchema.parse({
        overallStatus: 'WHATEVER',
        gaps: [],
      }),
    ).toThrow();
  });

  it('accepts a clean report', () => {
    expect(
      ScopeGapReportSchema.parse({ overallStatus: 'CLEAN', gaps: [] }).overallStatus,
    ).toBe('CLEAN');
  });
});

describe('computeScopeGapRollup', () => {
  it('counts severity + category + blocking', () => {
    const report = ScopeGapReportSchema.parse({
      overallStatus: 'MAJOR_GAPS',
      gaps: [
        { severity: 'HIGH', category: 'MISSING_LINE', message: 'No traffic control line' },
        { severity: 'HIGH', category: 'MISSING_LINE', message: 'No SWPPP line' },
        { severity: 'MEDIUM', category: 'QUANTITY_LOW', message: 'AC tonnage looks low' },
        { severity: 'LOW', category: 'SCOPE_AMBIGUOUS', message: 'Per-yard concrete spec is fuzzy' },
      ],
    });
    const r = computeScopeGapRollup(report);
    expect(r.total).toBe(4);
    expect(r.blockingCount).toBe(2);
    expect(r.bySeverity.HIGH).toBe(2);
    expect(r.bySeverity.MEDIUM).toBe(1);
    expect(r.bySeverity.LOW).toBe(1);
    expect(r.byCategory.MISSING_LINE).toBe(2);
  });
});

describe('sortGaps', () => {
  it('sorts HIGH first, then MEDIUM, then LOW', () => {
    const gaps: ScopeGap[] = [
      { severity: 'LOW', category: 'OTHER', message: 'a' },
      { severity: 'HIGH', category: 'MISSING_LINE', message: 'b' },
      { severity: 'MEDIUM', category: 'QUANTITY_LOW', message: 'c' },
    ];
    const sorted = sortGaps(gaps);
    expect(sorted.map((g) => g.severity)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
  });
});
