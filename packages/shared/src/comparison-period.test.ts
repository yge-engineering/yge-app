import { describe, expect, it } from 'vitest';
import {
  comparisonPeriod,
  comparisonModeLabel,
  inclusiveDaySpan,
  priorYearDate,
  varianceCents,
  variancePct,
} from './comparison-period';

describe('inclusiveDaySpan', () => {
  it('counts both endpoints', () => {
    expect(inclusiveDaySpan('2026-01-01', '2026-01-01')).toBe(1);
    expect(inclusiveDaySpan('2026-01-01', '2026-01-31')).toBe(31);
  });
});

describe('priorYearDate', () => {
  it('shifts back one year', () => {
    expect(priorYearDate('2026-06-30')).toBe('2025-06-30');
  });
  it('clamps Feb 29 to Feb 28 in a non-leap prior year', () => {
    expect(priorYearDate('2024-02-29')).toBe('2023-02-28');
  });
});

describe('comparisonPeriod', () => {
  it('PRIOR_YEAR shifts both endpoints back a year', () => {
    expect(comparisonPeriod('2026-04-01', '2026-06-30', 'PRIOR_YEAR')).toEqual({
      start: '2025-04-01',
      end: '2025-06-30',
    });
  });

  it('PRIOR_PERIOD is the same-length window ending the day before start', () => {
    // Q2 (Apr 1 - Jun 30, 91 days) -> Jan 1 - Mar 31 (90 days)... check span match.
    const prior = comparisonPeriod('2026-04-01', '2026-06-30', 'PRIOR_PERIOD');
    expect(prior.end).toBe('2026-03-31');
    expect(inclusiveDaySpan(prior.start, prior.end)).toBe(
      inclusiveDaySpan('2026-04-01', '2026-06-30'),
    );
  });

  it('PRIOR_PERIOD for a single month lands on the previous month', () => {
    const prior = comparisonPeriod('2026-02-01', '2026-02-28', 'PRIOR_PERIOD');
    expect(prior.end).toBe('2026-01-31');
    expect(prior.start).toBe('2026-01-04'); // 28-day window ending Jan 31
  });
});

describe('variance', () => {
  it('variancePct returns a signed fraction', () => {
    expect(variancePct(125, 100)).toBeCloseTo(0.25);
    expect(variancePct(75, 100)).toBeCloseTo(-0.25);
  });
  it('variancePct returns null when prior is zero', () => {
    expect(variancePct(100, 0)).toBeNull();
  });
  it('variancePct uses absolute prior for sign correctness', () => {
    // prior -100 (a credit/loss), current -50 -> improvement of +50 over |100|.
    expect(variancePct(-50, -100)).toBeCloseTo(0.5);
  });
  it('varianceCents is current - prior', () => {
    expect(varianceCents(125, 100)).toBe(25);
  });
});

describe('comparisonModeLabel', () => {
  it('labels the modes', () => {
    expect(comparisonModeLabel('PRIOR_YEAR')).toBe('Prior year');
    expect(comparisonModeLabel('PRIOR_PERIOD')).toBe('Prior period');
  });
});
