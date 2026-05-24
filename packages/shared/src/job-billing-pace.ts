// Per-job billing-pace tracker.
//
// Plain English: a job worth $1.2M with NTP 2026-04-01 and a planned
// finish 2026-09-30 SHOULD bill roughly $200K/month if work tracks the
// schedule. If by 2026-07-01 we've only billed $300K we're behind on
// invoicing — and behind on cash, since unbilled work doesn't pay AR.
//
// This helper compares actual revenue billed (sum of AR-invoice
// totalCents on the job) against the linear pro-rata expectation based
// on calendar days elapsed. Naïve linear; more sophisticated S-curve
// pacing comes later when YGE has enough historical jobs to fit one.

/** Inputs for the pace calculation. All cents, all yyyy-mm-dd. */
export interface BillingPaceInput {
  contractTotalCents: number;
  noticeToProceedDate: string;
  plannedEndDate: string;
  /** Sum of paid + unpaid invoices billed to date. */
  revenueBilledCents: number;
  /** Today, in yyyy-mm-dd. */
  asOfDate: string;
}

export type BillingPaceStatus = 'ON_TRACK' | 'BEHIND' | 'AHEAD' | 'NOT_STARTED' | 'COMPLETE';

export interface BillingPaceResult {
  status: BillingPaceStatus;
  /** Fraction of the calendar duration that has elapsed (0–1+,
   *  capped at 1.0 when past planned end). */
  elapsedFraction: number;
  /** Fraction of the contract billed so far (0–1+). May exceed 1.0
   *  on a change-order-heavy job. */
  billedFraction: number;
  /** Expected billing at this point in the schedule (linear). */
  expectedBilledCents: number;
  /** Actual minus expected (positive = ahead, negative = behind). */
  varianceCents: number;
  /** Plain-English explanation for the UI. */
  note: string;
}

/** Days between two yyyy-mm-dd strings. Signed (b - a). */
function daysBetween(a: string, b: string): number {
  const aMs = new Date(a + 'T00:00:00Z').getTime();
  const bMs = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((bMs - aMs) / (1000 * 60 * 60 * 24));
}

/** Tolerance band: within ±5% of expected = ON_TRACK. Outside = BEHIND
 *  or AHEAD. Wide-ish on purpose so a 1-week slip on a 6-month job
 *  doesn't fire alarms. */
const TRACK_BAND = 0.05;

export function computeBillingPace(input: BillingPaceInput): BillingPaceResult {
  const totalDays = daysBetween(input.noticeToProceedDate, input.plannedEndDate);
  if (totalDays <= 0) {
    return {
      status: 'NOT_STARTED',
      elapsedFraction: 0,
      billedFraction: 0,
      expectedBilledCents: 0,
      varianceCents: 0,
      note: 'Planned end date is at or before NTP — fix the dates before pacing applies.',
    };
  }
  const elapsedDays = daysBetween(input.noticeToProceedDate, input.asOfDate);
  if (elapsedDays < 0) {
    return {
      status: 'NOT_STARTED',
      elapsedFraction: 0,
      billedFraction: 0,
      expectedBilledCents: 0,
      varianceCents: 0,
      note: 'NTP is in the future — no billing expected yet.',
    };
  }

  const elapsedFractionRaw = elapsedDays / totalDays;
  const elapsedFraction = Math.min(1, elapsedFractionRaw);
  const billedFraction =
    input.contractTotalCents > 0
      ? input.revenueBilledCents / input.contractTotalCents
      : 0;
  const expectedBilledCents = Math.round(
    elapsedFraction * input.contractTotalCents,
  );
  const varianceCents = input.revenueBilledCents - expectedBilledCents;

  if (elapsedFractionRaw >= 1 && billedFraction >= 0.95) {
    return {
      status: 'COMPLETE',
      elapsedFraction,
      billedFraction,
      expectedBilledCents,
      varianceCents,
      note: `Past planned end (${(elapsedFractionRaw * 100).toFixed(0)}% elapsed) and ${(billedFraction * 100).toFixed(0)}% billed — close out the job.`,
    };
  }

  const deviation = billedFraction - elapsedFraction;
  let status: BillingPaceStatus;
  let note: string;
  if (Math.abs(deviation) <= TRACK_BAND) {
    status = 'ON_TRACK';
    note = `Billing tracks the schedule (${(billedFraction * 100).toFixed(0)}% billed at ${(elapsedFraction * 100).toFixed(0)}% elapsed).`;
  } else if (deviation > 0) {
    status = 'AHEAD';
    note = `Ahead on billing — ${(billedFraction * 100).toFixed(0)}% billed but only ${(elapsedFraction * 100).toFixed(0)}% of the schedule elapsed. Verify with the field.`;
  } else {
    status = 'BEHIND';
    note = `Behind on billing — ${(billedFraction * 100).toFixed(0)}% billed at ${(elapsedFraction * 100).toFixed(0)}% elapsed. Pull together a progress payment before month-end.`;
  }

  return {
    status,
    elapsedFraction,
    billedFraction,
    expectedBilledCents,
    varianceCents,
    note,
  };
}
