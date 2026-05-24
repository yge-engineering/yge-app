// Sub-bid lead-time helper.
//
// Plain English: YGE is bidding a prime. We need numbers from subs for
// trucking, electrical, striping, etc. If we send the sub-bid request
// the day before the prime is due, no sub will respond in time. The
// rule of thumb: 7 business days for routine trades; 14 for specialty
// (deep foundation, electrical with permit, prefab fabrication, etc.).
//
// This helper takes the prime bid due date + a list of needed sub
// trades and returns the latest date for each — drives a "send sub
// requests NLT" reminder on the bid editor.

import { subtractBusinessDays, isBusinessDay, type CalDate } from './california-holidays';

/** Tag for the trade. The helper picks the right lead-time bucket
 *  off this tag. Free-form so callers can pass their own custom
 *  trade names (default lead applies). */
export type SubTradeKind =
  | 'TRUCKING'
  | 'STRIPING'
  | 'CONCRETE_FLATWORK'
  | 'ASPHALT'
  | 'AGGREGATE_SUPPLY'
  | 'RENTAL_LARGE'
  | 'ELECTRICAL'           // SPECIALTY — usually needs permit data
  | 'PREFAB_STRUCTURAL'    // SPECIALTY — fab lead time
  | 'DEEP_FOUNDATION'      // SPECIALTY — drilling crew schedule
  | 'TRAFFIC_CONTROL'
  | 'EROSION_CONTROL'
  | 'CUSTOM';

/** Per-trade default lead-time in BUSINESS DAYS (skipping CA holidays
 *  + weekends). Specialty trades default to 14; routine to 7. */
const TRADE_LEAD_DAYS: Record<SubTradeKind, number> = {
  TRUCKING: 7,
  STRIPING: 7,
  CONCRETE_FLATWORK: 7,
  ASPHALT: 7,
  AGGREGATE_SUPPLY: 7,
  RENTAL_LARGE: 7,
  TRAFFIC_CONTROL: 7,
  EROSION_CONTROL: 7,
  ELECTRICAL: 14,
  PREFAB_STRUCTURAL: 14,
  DEEP_FOUNDATION: 14,
  CUSTOM: 7,
};

export interface SubBidLeadInput {
  trade: SubTradeKind;
  /** Display label for the trade in the UI. */
  label?: string;
  /** Optional override — caller has special intel about the sub. */
  leadDaysOverride?: number;
}

export interface SubBidLeadResult extends SubBidLeadInput {
  /** The latest CA-business date YGE should send the sub-bid request. */
  sendByDate: CalDate;
  /** Business days of lead time the recommendation gives. */
  leadDays: number;
}

export interface BuildSubBidLeadInput {
  /** Prime bid due date (yyyy-mm-dd). */
  primeBidDueDate: CalDate;
  /** Trades YGE needs sub numbers for. */
  trades: SubBidLeadInput[];
}

export function buildSubBidLeadPlan(
  input: BuildSubBidLeadInput,
): SubBidLeadResult[] {
  return input.trades.map((t) => {
    const leadDays = t.leadDaysOverride ?? TRADE_LEAD_DAYS[t.trade] ?? 7;
    const sendByDate = subtractBusinessDays(input.primeBidDueDate, leadDays);
    return {
      ...t,
      leadDays,
      sendByDate,
    };
  });
}

/** Convenience: the earliest send-by date across all trades, i.e.
 *  "if you send requests today by latest THIS date, you've covered
 *  every sub at full lead time." Returns undefined when trades is
 *  empty. */
export function earliestSendByDate(
  plan: SubBidLeadResult[],
): CalDate | undefined {
  if (plan.length === 0) return undefined;
  return plan.reduce(
    (earliest, row) =>
      earliest === undefined || row.sendByDate < earliest
        ? row.sendByDate
        : earliest,
    plan[0]!.sendByDate,
  );
}

/** Convenience: how many business days from `today` until the earliest
 *  send-by date. Negative when at least one trade is already past its
 *  send-by date — UI surfaces this as "Late on N subs". */
export function daysUntilEarliestSend(
  plan: SubBidLeadResult[],
  today: CalDate,
): number | undefined {
  const earliest = earliestSendByDate(plan);
  if (!earliest) return undefined;
  // Count business days between today and earliest. Snap today to the
  // next business day so a weekend `today` doesn't add fake margin.
  let cursor = today;
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, 1);
  if (cursor > earliest) {
    // Already past — count backwards as negative.
    let days = 0;
    let c = earliest;
    while (c < cursor) {
      c = addDays(c, 1);
      if (isBusinessDay(c)) days += 1;
    }
    return -days;
  }
  let days = 0;
  let c = cursor;
  while (c < earliest) {
    c = addDays(c, 1);
    if (isBusinessDay(c)) days += 1;
  }
  return days;
}

// Local addDays mirror — copy-pasted to avoid widening the imports
// surface for one helper. Pure +N days arithmetic.
function addDays(date: CalDate, days: number): CalDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
