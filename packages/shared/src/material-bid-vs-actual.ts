// Material bid-vs-actual reconciliation.
//
// Per the v6.3 gap analysis (Phase 3 — "AI material bid-vs-actual
// ledger"): existing material-price-history + job-material-spend roll
// up AP spend, but nothing compares a job's bid TAKEOFF line items
// against the actual AP invoices that flowed through.
//
// This is the "did we underestimate?" report:
//   - For each bid line, sum the AP spend matched by cost code.
//   - Compute the quantity + dollar variance.
//   - Bucket each line into OVER_BUDGET / UNDER_BUDGET / ON_BUDGET / UNTRACKED.
//   - Surface "unbid spend" — AP rows whose cost code does NOT appear
//     in the bid takeoff, which means the PM bought something the bid
//     didn't account for (added scope, missed scope, or miscoded AP).
//
// Pure derivation. Caller hands in the takeoff rows + the AP rows for
// the job + the as-of date; receives the report. No DB, no API.
//
// Matching strategy:
//   - Primary key is `costCode`. Most heavy-civil contractors code AP
//     by CSI / company-internal cost code, and bid line items have the
//     same code, so this is the natural join.
//   - Bid lines without a costCode are skipped (caller's data hygiene
//     problem — surfacing them silently would inflate variances).
//   - AP rows without a costCode are bucketed into UNBID_SPEND with
//     `costCode = '(uncoded)'`.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const BidLineForReconcileSchema = z.object({
  id: z.string().min(1),
  costCode: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  quantity: z.number().nonnegative(),
  unit: z.string().max(20),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type BidLineForReconcile = z.infer<typeof BidLineForReconcileSchema>;

export const ActualSpendLineSchema = z.object({
  invoiceId: z.string().min(1),
  /** Cost code as coded on the AP invoice. Empty / missing = orphaned. */
  costCode: z.string().max(60).optional(),
  description: z.string().max(300).optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().max(20).optional(),
  totalCents: z.number().int(),
  postedOn: z.string().regex(ISO_DATE).optional(),
});
export type ActualSpendLine = z.infer<typeof ActualSpendLineSchema>;

export const BidLineVarianceStatusSchema = z.enum([
  'ON_BUDGET',
  'OVER_BUDGET',
  'UNDER_BUDGET',
  'UNTRACKED',
]);
export type BidLineVarianceStatus = z.infer<typeof BidLineVarianceStatusSchema>;

export interface BidLineVariance {
  bidLineId: string;
  costCode: string;
  description: string;
  bidQuantity: number;
  bidUnit: string;
  bidTotalCents: number;
  actualQuantity: number;
  actualTotalCents: number;
  /** (actualQty - bidQty) / bidQty. NaN if bidQty == 0. */
  quantityVariancePct: number;
  /** actualTotal - bidTotal. Positive = over budget. */
  costVarianceCents: number;
  /** costVarianceCents / bidTotal, as a decimal. NaN if bidTotal == 0. */
  costVariancePct: number;
  status: BidLineVarianceStatus;
  /** AP invoices that contributed to this line's actuals. */
  apInvoiceIds: string[];
}

export interface UnbidSpendRow {
  costCode: string;
  totalCents: number;
  invoiceIds: string[];
}

export interface BidVsActualReport {
  jobId: string;
  asOfDate: string;
  totalBidCents: number;
  totalActualCents: number;
  /** actual - bid. Positive = over budget. */
  totalVarianceCents: number;
  /** totalVariance / totalBid as decimal. NaN if total bid == 0. */
  totalVariancePct: number;
  lineVariances: BidLineVariance[];
  unbidSpend: UnbidSpendRow[];
}

export interface ReconcileOptions {
  /** Absolute variance % at or below which a line is ON_BUDGET (defaults
   *  to 0.05 = ±5%). */
  onBudgetTolerance?: number;
}

const DEFAULT_TOLERANCE = 0.05;

/** Build the reconciliation report. Pure; no side effects. */
export function reconcileBidVsActual(
  jobId: string,
  asOfDate: string,
  bidLines: BidLineForReconcile[],
  actuals: ActualSpendLine[],
  options: ReconcileOptions = {},
): BidVsActualReport {
  const tol = options.onBudgetTolerance ?? DEFAULT_TOLERANCE;

  // Group actuals by lowercase costCode for matching. AP rows without a
  // costCode go into the unbid bucket.
  const actualsByCode = new Map<string, ActualSpendLine[]>();
  const uncoded: ActualSpendLine[] = [];
  for (const a of actuals) {
    const code = a.costCode?.trim().toLowerCase();
    if (!code) {
      uncoded.push(a);
      continue;
    }
    const list = actualsByCode.get(code) ?? [];
    list.push(a);
    actualsByCode.set(code, list);
  }

  const matchedCodes = new Set<string>();
  const lineVariances: BidLineVariance[] = [];

  for (const bid of bidLines) {
    const code = bid.costCode.trim().toLowerCase();
    matchedCodes.add(code);
    const matches = actualsByCode.get(code) ?? [];
    const actualQty = sumWhereDefined(matches, (m) => m.quantity);
    const actualTotalCents = matches.reduce((s, m) => s + m.totalCents, 0);
    const apInvoiceIds = Array.from(new Set(matches.map((m) => m.invoiceId)));

    const quantityVariancePct =
      bid.quantity > 0 ? (actualQty - bid.quantity) / bid.quantity : NaN;
    const costVarianceCents = actualTotalCents - bid.totalCents;
    const costVariancePct =
      bid.totalCents > 0 ? costVarianceCents / bid.totalCents : NaN;
    const status: BidLineVarianceStatus =
      matches.length === 0
        ? 'UNTRACKED'
        : Math.abs(costVariancePct) <= tol
          ? 'ON_BUDGET'
          : costVariancePct > 0
            ? 'OVER_BUDGET'
            : 'UNDER_BUDGET';

    lineVariances.push({
      bidLineId: bid.id,
      costCode: bid.costCode,
      description: bid.description,
      bidQuantity: bid.quantity,
      bidUnit: bid.unit,
      bidTotalCents: bid.totalCents,
      actualQuantity: round2(actualQty),
      actualTotalCents,
      quantityVariancePct: round4(quantityVariancePct),
      costVarianceCents,
      costVariancePct: round4(costVariancePct),
      status,
      apInvoiceIds,
    });
  }

  // Unbid spend = (any code present in actuals but NOT in bidLines)
  //               + (everything uncoded).
  const unbid: Map<string, UnbidSpendRow> = new Map();
  for (const [code, list] of actualsByCode.entries()) {
    if (matchedCodes.has(code)) continue;
    const total = list.reduce((s, m) => s + m.totalCents, 0);
    const invoiceIds = Array.from(new Set(list.map((m) => m.invoiceId)));
    unbid.set(code, { costCode: list[0]!.costCode!, totalCents: total, invoiceIds });
  }
  if (uncoded.length > 0) {
    unbid.set('(uncoded)', {
      costCode: '(uncoded)',
      totalCents: uncoded.reduce((s, m) => s + m.totalCents, 0),
      invoiceIds: Array.from(new Set(uncoded.map((m) => m.invoiceId))),
    });
  }

  const totalBidCents = bidLines.reduce((s, b) => s + b.totalCents, 0);
  const totalActualCents = actuals.reduce((s, a) => s + a.totalCents, 0);
  const totalVarianceCents = totalActualCents - totalBidCents;
  const totalVariancePct =
    totalBidCents > 0 ? totalVarianceCents / totalBidCents : NaN;

  return {
    jobId,
    asOfDate,
    totalBidCents,
    totalActualCents,
    totalVarianceCents,
    totalVariancePct: round4(totalVariancePct),
    lineVariances,
    unbidSpend: Array.from(unbid.values()).sort(
      (a, b) => b.totalCents - a.totalCents,
    ),
  };
}

/** Filter for lines worth flagging in a summary view. */
export function flaggedLines(report: BidVsActualReport): BidLineVariance[] {
  return report.lineVariances.filter(
    (l) => l.status === 'OVER_BUDGET' || l.status === 'UNDER_BUDGET',
  );
}

function sumWhereDefined<T>(arr: T[], pick: (t: T) => number | undefined): number {
  return arr.reduce((s, t) => {
    const v = pick(t);
    return s + (typeof v === 'number' ? v : 0);
  }, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}
