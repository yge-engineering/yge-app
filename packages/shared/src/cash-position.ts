// Daily cash position tracker.
//
// Plain English: a simple day-by-day in / out / running balance
// view. AR payments hit on receivedOn, AP payments hit on paidOn.
// Net for the day = AR in − AP out. Running balance starts at the
// caller-supplied opening balance.
//
// Pure derivation. No persisted records. Distinct from cash-forecast
// which is forward-looking; this is the actuals up to asOf.

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

export interface CashPositionDay {
  date: string;
  /** AR receipts that day. */
  arInCents: number;
  /** AP payments that day. */
  apOutCents: number;
  /** arInCents - apOutCents. */
  netCents: number;
  /** Running balance after this day. */
  runningBalanceCents: number;
}

export interface CashPositionReport {
  start: string;
  end: string;
  openingBalanceCents: number;
  totalArInCents: number;
  totalApOutCents: number;
  netCents: number;
  closingBalanceCents: number;
  days: CashPositionDay[];
  /** Day with the largest negative net (biggest cash drain). */
  worstDay: CashPositionDay | null;
  /** Day with the largest positive net (biggest receipt day). */
  bestDay: CashPositionDay | null;
}

export interface CashPositionInputs {
  start: string;
  end: string;
  openingBalanceCents: number;
  arPayments: ArPayment[];
  apPayments: ApPayment[];
}

export function buildCashPositionReport(
  inputs: CashPositionInputs,
): CashPositionReport {
  const { start, end, openingBalanceCents, arPayments, apPayments } = inputs;

  // Bucket by date.
  const arByDate = new Map<string, number>();
  const apByDate = new Map<string, number>();

  for (const p of arPayments) {
    if (p.receivedOn < start || p.receivedOn > end) continue;
    arByDate.set(p.receivedOn, (arByDate.get(p.receivedOn) ?? 0) + p.amountCents);
  }
  for (const p of apPayments) {
    if (p.paidOn < start || p.paidOn > end) continue;
    apByDate.set(p.paidOn, (apByDate.get(p.paidOn) ?? 0) + p.amountCents);
  }

  // Walk every calendar day in the window so the output is dense
  // (no missing days even when nothing happened).
  const days: CashPositionDay[] = [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return {
      start,
      end,
      openingBalanceCents,
      totalArInCents: 0,
      totalApOutCents: 0,
      netCents: 0,
      closingBalanceCents: openingBalanceCents,
      days: [],
      worstDay: null,
      bestDay: null,
    };
  }

  let running = openingBalanceCents;
  let totalArIn = 0;
  let totalApOut = 0;
  let worstDay: CashPositionDay | null = null;
  let bestDay: CashPositionDay | null = null;

  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (let t = startMs; t <= endMs; t += ONE_DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const arIn = arByDate.get(date) ?? 0;
    const apOut = apByDate.get(date) ?? 0;
    const net = arIn - apOut;
    running += net;
    const day: CashPositionDay = {
      date,
      arInCents: arIn,
      apOutCents: apOut,
      netCents: net,
      runningBalanceCents: running,
    };
    days.push(day);
    totalArIn += arIn;
    totalApOut += apOut;
    if (!worstDay || net < worstDay.netCents) worstDay = day;
    if (!bestDay || net > bestDay.netCents) bestDay = day;
  }

  return {
    start,
    end,
    openingBalanceCents,
    totalArInCents: totalArIn,
    totalApOutCents: totalApOut,
    netCents: totalArIn - totalApOut,
    closingBalanceCents: running,
    days,
    worstDay,
    bestDay,
  };
}
