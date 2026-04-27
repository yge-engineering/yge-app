// 12-week cash flow forecast.
//
// Pure derivation module — no new persisted records. Pulls open AR
// invoices and AP invoices into a weekly in/out projection so Brook +
// Ryan can see a thin spot before it lands instead of after.
//
// Phase 1 inputs:
//   - AR invoices: outstanding balance, due date (or 30 days from
//     invoice date if not set)
//   - AP invoices: outstanding balance, due date (or 30 days from
//     invoice date if not set)
//   - Optional caller-supplied weekly payroll burn (cents/week)
//
// Phase 2 will fold in: bank starting balance, certified payroll
// runs, equipment loan payments, retention release projections.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import { arUnpaidBalanceCents } from './ar-invoice';

export interface CashFlowWeek {
  /** Monday of the ISO-week (yyyy-mm-dd). */
  weekStart: string;
  /** Friday of the same week (yyyy-mm-dd) — display only. */
  weekEnd: string;
  /** Money expected in from AR (cents). */
  arInflowCents: number;
  /** Money out for AP (cents). */
  apOutflowCents: number;
  /** Weekly payroll burn (cents). */
  payrollOutflowCents: number;
  /** Net = inflow − outflow (cents). */
  netCents: number;
  /** Running cash balance — sum of nets through this week. */
  runningCents: number;
  /** AR invoices contributing to this week. */
  arInvoices: Array<{ id: string; jobId: string; cents: number }>;
  /** AP invoices contributing to this week. */
  apInvoices: Array<{ id: string; vendorName: string; cents: number }>;
}

export interface CashForecastInputs {
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  /** Weekly payroll burn in cents. Defaults to 0. */
  weeklyPayrollCents?: number;
  /** Starting cash balance in cents. Defaults to 0 — caller should
   *  pass actual operating-account balance for a real forecast. */
  startingBalanceCents?: number;
  /** Number of weeks to project. Defaults to 12. */
  weeks?: number;
  /** Anchor date — first day of the forecast. Defaults to Monday of
   *  the current ISO-week. */
  asOf?: Date;
}

/** Return Monday at 00:00 UTC of the ISO-week containing `d`. */
function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back up to Monday
  const result = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff),
  );
  return result;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fall-back due date for an AR/AP invoice that doesn't have one
 *  recorded — invoice date + 30 days. */
function effectiveDueDate(invoiceDate: string, dueDate?: string): string {
  if (dueDate) return dueDate;
  const d = new Date(invoiceDate + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return invoiceDate;
  d.setUTCDate(d.getUTCDate() + 30);
  return fmt(d);
}

export interface CashForecast {
  weeks: CashFlowWeek[];
  totalArInflowCents: number;
  totalApOutflowCents: number;
  totalPayrollOutflowCents: number;
  totalNetCents: number;
  /** Starting cash balance carried into week 0. */
  startingBalanceCents: number;
  /** Final running balance after the last week. */
  endingBalanceCents: number;
  /** Number of weeks where the running balance ends negative. */
  negativeWeekCount: number;
  /** Index of the first negative week, or null. */
  firstNegativeWeekIndex: number | null;
}

export function buildCashForecast(args: CashForecastInputs): CashForecast {
  const weeklyPayrollCents = args.weeklyPayrollCents ?? 0;
  const startingBalanceCents = args.startingBalanceCents ?? 0;
  const weekCount = args.weeks ?? 12;
  const start = mondayOf(args.asOf ?? new Date());

  // Build empty week buckets.
  const weeks: CashFlowWeek[] = [];
  for (let i = 0; i < weekCount; i += 1) {
    const ws = new Date(start);
    ws.setUTCDate(ws.getUTCDate() + i * 7);
    const we = new Date(ws);
    we.setUTCDate(we.getUTCDate() + 4); // Friday
    weeks.push({
      weekStart: fmt(ws),
      weekEnd: fmt(we),
      arInflowCents: 0,
      apOutflowCents: 0,
      payrollOutflowCents: weeklyPayrollCents,
      netCents: 0,
      runningCents: 0,
      arInvoices: [],
      apInvoices: [],
    });
  }

  function bucketIndex(due: string): number {
    // Snap due date to its Monday-week, find matching index.
    const d = new Date(due + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return -1;
    const wsTarget = mondayOf(d);
    for (let i = 0; i < weeks.length; i += 1) {
      const ws = weeks[i]!.weekStart;
      const dt = new Date(ws + 'T00:00:00Z');
      if (
        wsTarget.getUTCFullYear() === dt.getUTCFullYear() &&
        wsTarget.getUTCMonth() === dt.getUTCMonth() &&
        wsTarget.getUTCDate() === dt.getUTCDate()
      ) {
        return i;
      }
    }
    // Past-due (before week 0) collapses into week 0; beyond horizon drops.
    if (wsTarget.getTime() < new Date(weeks[0]!.weekStart + 'T00:00:00Z').getTime()) {
      return 0;
    }
    return -1;
  }

  // AR inflows.
  for (const inv of args.arInvoices) {
    if (inv.status === 'PAID' || inv.status === 'WRITTEN_OFF') continue;
    const balance = arUnpaidBalanceCents(inv);
    if (balance <= 0) continue;
    const due = effectiveDueDate(inv.invoiceDate, inv.dueDate);
    const idx = bucketIndex(due);
    if (idx < 0) continue;
    const w = weeks[idx]!;
    w.arInflowCents += balance;
    w.arInvoices.push({ id: inv.id, jobId: inv.jobId, cents: balance });
  }

  // AP outflows.
  for (const inv of args.apInvoices) {
    if (inv.status === 'REJECTED') continue;
    const balance = Math.max(0, inv.totalCents - inv.paidCents);
    if (balance <= 0) continue;
    const due = effectiveDueDate(inv.invoiceDate, inv.dueDate);
    const idx = bucketIndex(due);
    if (idx < 0) continue;
    const w = weeks[idx]!;
    w.apOutflowCents += balance;
    w.apInvoices.push({ id: inv.id, vendorName: inv.vendorName, cents: balance });
  }

  // Compute nets + running balance.
  let running = startingBalanceCents;
  let totalArInflowCents = 0;
  let totalApOutflowCents = 0;
  let totalPayrollOutflowCents = 0;
  let firstNegativeWeekIndex: number | null = null;
  let negativeWeekCount = 0;
  for (let i = 0; i < weeks.length; i += 1) {
    const w = weeks[i]!;
    w.netCents = w.arInflowCents - w.apOutflowCents - w.payrollOutflowCents;
    running += w.netCents;
    w.runningCents = running;
    totalArInflowCents += w.arInflowCents;
    totalApOutflowCents += w.apOutflowCents;
    totalPayrollOutflowCents += w.payrollOutflowCents;
    if (running < 0) {
      negativeWeekCount += 1;
      if (firstNegativeWeekIndex == null) firstNegativeWeekIndex = i;
    }
  }

  return {
    weeks,
    totalArInflowCents,
    totalApOutflowCents,
    totalPayrollOutflowCents,
    totalNetCents:
      totalArInflowCents - totalApOutflowCents - totalPayrollOutflowCents,
    startingBalanceCents,
    endingBalanceCents: running,
    negativeWeekCount,
    firstNegativeWeekIndex,
  };
}
