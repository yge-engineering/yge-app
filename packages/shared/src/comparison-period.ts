// Comparison-period math for financial statements.
//
// A real P&L / balance sheet shows the current period next to a comparison
// period so you can see the trend. Two modes:
//
//   PRIOR_PERIOD — the same-length window ending the day before this one.
//                  (Apr 1–Jun 30 -> Jan 1–Mar 31.)
//   PRIOR_YEAR   — the same calendar dates shifted back one year.
//                  (Apr 1–Jun 30 2026 -> Apr 1–Jun 30 2025.)
//
// All dates are ISO "yyyy-mm-dd". Pure functions — no Date-locale surprises
// (everything is computed in UTC).

export type ComparisonMode = 'PRIOR_PERIOD' | 'PRIOR_YEAR';

export interface DatePeriod {
  start: string;
  end: string;
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, (m! - 1), d!));
}

function fromUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (end - start), inclusive of both ends. */
export function inclusiveDaySpan(start: string, end: string): number {
  const ms = toUtc(end).getTime() - toUtc(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Shift an ISO date back exactly one year, clamping Feb 29 -> Feb 28. */
export function priorYearDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const year = y! - 1;
  // Clamp the day to the last valid day of that month in the prior year.
  const lastDay = new Date(Date.UTC(year, m!, 0)).getUTCDate();
  const day = Math.min(d!, lastDay);
  return fromUtc(new Date(Date.UTC(year, m! - 1, day)));
}

/**
 * Derive the comparison period for a given current period + mode.
 *
 * PRIOR_PERIOD: ends the day before `start`; same inclusive length.
 * PRIOR_YEAR:   both endpoints shifted back one year.
 */
export function comparisonPeriod(
  start: string,
  end: string,
  mode: ComparisonMode,
): DatePeriod {
  if (mode === 'PRIOR_YEAR') {
    return { start: priorYearDate(start), end: priorYearDate(end) };
  }
  // PRIOR_PERIOD
  const span = inclusiveDaySpan(start, end); // days, inclusive
  const priorEnd = new Date(toUtc(start).getTime() - 86_400_000); // day before start
  const priorStart = new Date(priorEnd.getTime() - (span - 1) * 86_400_000);
  return { start: fromUtc(priorStart), end: fromUtc(priorEnd) };
}

/**
 * Variance of current vs prior as a fraction (0.25 = +25%). Returns null
 * when there's no prior basis (prior === 0) so callers can render "—"
 * instead of a divide-by-zero. Sign follows (current - prior).
 */
export function variancePct(currentCents: number, priorCents: number): number | null {
  if (priorCents === 0) return null;
  return (currentCents - priorCents) / Math.abs(priorCents);
}

/** Absolute variance in cents (current - prior). */
export function varianceCents(currentCents: number, priorCents: number): number {
  return currentCents - priorCents;
}

export function comparisonModeLabel(mode: ComparisonMode): string {
  return mode === 'PRIOR_YEAR' ? 'Prior year' : 'Prior period';
}
