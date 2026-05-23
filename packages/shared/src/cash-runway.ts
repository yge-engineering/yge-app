// Cash-runway projector.
//
// Heavy-civil cash flow is lumpy: progress invoices land in
// 1-3-month chunks, payroll runs weekly, fuel + materials hit
// daily. The classic "we've got $X in the bank" misses the
// retention coming in, the bond premium going out next month,
// and the payroll Friday. This module projects week-by-week
// running cash so the office sees the dip BEFORE it happens.
//
// Pure: takes a starting balance + scheduled inflows + outflows
// + an analysis horizon, returns a weekly series with running
// balance and a "lowest" flag.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CashFlowItemKindSchema = z.enum(['INFLOW', 'OUTFLOW']);
export type CashFlowItemKind = z.infer<typeof CashFlowItemKindSchema>;

export const CashFlowItemSchema = z.object({
  /** Stable id from the source record (AR invoice id, AP id, etc.). */
  id: z.string().min(1),
  kind: CashFlowItemKindSchema,
  /** Date the cash is expected to clear (yyyy-mm-dd). */
  expectedOn: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Always positive cents — kind tells you the direction. */
  amountCents: z.number().int().nonnegative(),
  /** Short human label for the chart tooltip. */
  description: z.string().min(1).max(200),
  /** Optional confidence (0..1). Default 1 = certain. The series
   *  treats < 1 the same; we expose this so callers can fade
   *  speculative rows differently in the UI. */
  confidence: z.number().min(0).max(1).default(1),
});
export type CashFlowItem = z.infer<typeof CashFlowItemSchema>;

export interface CashRunwayWeek {
  /** Monday of the week, yyyy-mm-dd. */
  weekStarting: string;
  weekEnding: string;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  /** Running balance at the END of this week. */
  endingBalanceCents: number;
  /** True when this week's ending balance is the lowest in the series. */
  isLowest: boolean;
  items: CashFlowItem[];
}

export interface CashRunwayReport {
  startingBalanceCents: number;
  asOfDate: string;
  horizonWeeks: number;
  weeks: CashRunwayWeek[];
  /** Sum of all inflows across the horizon. */
  totalInflowCents: number;
  totalOutflowCents: number;
  /** End-of-horizon balance. */
  endingBalanceCents: number;
  /** The lowest week's ending balance. */
  lowestBalanceCents: number;
  /** First week where balance dropped below 0 (or 'never'). */
  firstNegativeWeek: string | null;
  /** Weeks until the lowest point. */
  weeksUntilLowest: number;
}

export interface BuildRunwayInput {
  startingBalanceCents: number;
  asOfDate: string;
  horizonWeeks: number;
  items: CashFlowItem[];
}

/** Build the weekly projection. Pure. */
export function buildCashRunway(input: BuildRunwayInput): CashRunwayReport {
  if (input.horizonWeeks <= 0) {
    throw new Error('horizonWeeks must be positive');
  }
  const start = mondayOf(input.asOfDate);
  const weeks: CashRunwayWeek[] = [];
  let runningBalance = input.startingBalanceCents;
  let totalInflow = 0;
  let totalOutflow = 0;
  for (let i = 0; i < input.horizonWeeks; i++) {
    const weekStarting = addDays(start, i * 7);
    const weekEnding = addDays(start, i * 7 + 6);
    const inWindow = input.items.filter(
      (it) => it.expectedOn >= weekStarting && it.expectedOn <= weekEnding,
    );
    const inflow = inWindow
      .filter((it) => it.kind === 'INFLOW')
      .reduce((s, it) => s + it.amountCents, 0);
    const outflow = inWindow
      .filter((it) => it.kind === 'OUTFLOW')
      .reduce((s, it) => s + it.amountCents, 0);
    const net = inflow - outflow;
    runningBalance += net;
    totalInflow += inflow;
    totalOutflow += outflow;
    weeks.push({
      weekStarting,
      weekEnding,
      inflowCents: inflow,
      outflowCents: outflow,
      netCents: net,
      endingBalanceCents: runningBalance,
      isLowest: false,
      items: inWindow.sort((a, b) => a.expectedOn.localeCompare(b.expectedOn)),
    });
  }

  let lowestBalance = Infinity;
  let lowestWeekIndex = 0;
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    if (w.endingBalanceCents < lowestBalance) {
      lowestBalance = w.endingBalanceCents;
      lowestWeekIndex = i;
    }
  }
  if (weeks[lowestWeekIndex]) weeks[lowestWeekIndex]!.isLowest = true;

  const firstNeg = weeks.find((w) => w.endingBalanceCents < 0);

  return {
    startingBalanceCents: input.startingBalanceCents,
    asOfDate: input.asOfDate,
    horizonWeeks: input.horizonWeeks,
    weeks,
    totalInflowCents: totalInflow,
    totalOutflowCents: totalOutflow,
    endingBalanceCents: runningBalance,
    lowestBalanceCents: weeks.length === 0 ? input.startingBalanceCents : lowestBalance,
    firstNegativeWeek: firstNeg?.weekStarting ?? null,
    weeksUntilLowest: lowestWeekIndex,
  };
}

// ---- date helpers ----

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}
function formatIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function addDays(iso: string, days: number): string {
  return formatIso(parseIso(iso) + days * 24 * 60 * 60 * 1000);
}
function mondayOf(iso: string): string {
  const ms = parseIso(iso);
  const dow = new Date(ms).getUTCDay(); // Sun = 0
  const sinceMonday = (dow + 6) % 7;
  return formatIso(ms - sinceMonday * 24 * 60 * 60 * 1000);
}
