// Cost code variance — bid vs actual per code per job.
//
// Plain English: mirrors the "Cost Code Variance" sheet in YGE's
// Excel. For one Job, walk every cost code that shows up in either
// the bid (ImportedEstimate.lines) or the actuals (AP invoice line
// items), and produce a row with BID totals, ACTUAL totals, and the
// variance.
//
// Phase-1 scope:
//   - bid side: from the ImportedEstimate linked to the job
//   - actual side: AP invoice lines whose jobId (line-level or
//     invoice-level) matches
// Time-card labor actuals would need an employee-rate join we don't
// have yet; flagged in the README + page UI when shipped.
//
// Pure derivation. No I/O.

import type { ApInvoice } from './ap-invoice';
import type {
  ImportedEstimate,
  ImportedEstimateLine,
} from './imported-estimate';
import type { CostCode } from './cost-code';

export interface CostVarianceRow {
  /** The cost code string (free-form Phase 1). */
  costCode: string;
  /** Description from the master CostCode list, when available; falls
   *  back to the first description we see in the bid lines. */
  description?: string;
  /** Category from the master CostCode list, when available. */
  category?: string;

  /** BID side. */
  bidQuantity: number;
  /** Weighted average unit cost across all bid lines for this code.
   *  When bidQuantity is 0 this is 0. */
  bidUnitCostCents: number;
  bidTotalCents: number;

  /** ACTUAL side. AP-only for now. */
  actualQuantity: number; // always 0 today — AP invoices don't track qty per code
  actualTotalCents: number;

  /** Variance = bid - actual. Positive = under budget (saved $);
   *  negative = over budget (cost more than bid). */
  varianceCents: number;
  /** Same idea as a fraction of bid: (bid - actual) / bid. Null when
   *  bid is 0 (we've spent on a code that wasn't bid for). */
  variancePercent: number | null;
}

interface ComputeInputs {
  jobId: string;
  importedEstimate: ImportedEstimate | null;
  apInvoices: ApInvoice[];
  /** Optional master cost-code list — used to fill description and
   *  category on rows that have actuals but no bid line. */
  costCodes?: CostCode[];
}

interface CodeBucket {
  bidQuantitySum: number;
  bidWeightedUnitCostSumCents: number; // sum of qty*unitCost (used for weighted avg)
  bidTotalCents: number;
  actualTotalCents: number;
  description?: string;
  category?: string;
}

function ensure(map: Map<string, CodeBucket>, code: string): CodeBucket {
  const existing = map.get(code);
  if (existing) return existing;
  const fresh: CodeBucket = {
    bidQuantitySum: 0,
    bidWeightedUnitCostSumCents: 0,
    bidTotalCents: 0,
    actualTotalCents: 0,
  };
  map.set(code, fresh);
  return fresh;
}

function addBidLine(map: Map<string, CodeBucket>, line: ImportedEstimateLine): void {
  if (!line.costCode) return;
  const code = line.costCode.trim();
  if (!code) return;
  const bucket = ensure(map, code);
  bucket.bidQuantitySum += line.quantity;
  bucket.bidWeightedUnitCostSumCents += line.quantity * line.unitCostCents;
  bucket.bidTotalCents += line.totalCostCents;
  if (!bucket.description && line.description) bucket.description = line.description;
}

function apLineMatchesJob(
  invoice: ApInvoice,
  line: ApInvoice['lineItems'][number],
  jobId: string,
): boolean {
  // Line-level jobId beats invoice-level. Either is OK.
  if (line.jobId) return line.jobId === jobId;
  return invoice.jobId === jobId;
}

function addActuals(
  map: Map<string, CodeBucket>,
  apInvoices: ApInvoice[],
  jobId: string,
): void {
  for (const inv of apInvoices) {
    for (const line of inv.lineItems) {
      if (!apLineMatchesJob(inv, line, jobId)) continue;
      const code = line.costCode?.trim();
      if (!code) continue; // un-coded actuals skipped
      const bucket = ensure(map, code);
      bucket.actualTotalCents += line.lineTotalCents;
    }
  }
}

function fillFromMaster(
  map: Map<string, CodeBucket>,
  costCodes: CostCode[],
): void {
  const byCode = new Map<string, CostCode>();
  for (const c of costCodes) byCode.set(c.code, c);
  for (const [code, bucket] of map.entries()) {
    if (!bucket.description || !bucket.category) {
      const master = byCode.get(code);
      if (master) {
        if (!bucket.description) bucket.description = master.description;
        if (!bucket.category) bucket.category = master.category;
      }
    }
  }
}

export function computeCostVariance(input: ComputeInputs): CostVarianceRow[] {
  const map = new Map<string, CodeBucket>();
  if (input.importedEstimate) {
    for (const line of input.importedEstimate.lines) addBidLine(map, line);
  }
  addActuals(map, input.apInvoices, input.jobId);
  if (input.costCodes) fillFromMaster(map, input.costCodes);

  const rows: CostVarianceRow[] = [];
  for (const [code, bucket] of map.entries()) {
    const bidUnitCostCents =
      bucket.bidQuantitySum > 0
        ? Math.round(bucket.bidWeightedUnitCostSumCents / bucket.bidQuantitySum)
        : 0;
    const varianceCents = bucket.bidTotalCents - bucket.actualTotalCents;
    const variancePercent =
      bucket.bidTotalCents > 0 ? varianceCents / bucket.bidTotalCents : null;
    rows.push({
      costCode: code,
      description: bucket.description,
      category: bucket.category,
      bidQuantity: bucket.bidQuantitySum,
      bidUnitCostCents,
      bidTotalCents: bucket.bidTotalCents,
      actualQuantity: 0, // AP doesn't carry qty per code; left for future
      actualTotalCents: bucket.actualTotalCents,
      varianceCents,
      variancePercent,
    });
  }
  // Sort: rows with any spend (bid or actual) come first, then alpha by code.
  rows.sort((a, b) => {
    const aHas = a.bidTotalCents > 0 || a.actualTotalCents > 0 ? 1 : 0;
    const bHas = b.bidTotalCents > 0 || b.actualTotalCents > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return a.costCode.localeCompare(b.costCode);
  });
  return rows;
}

export interface CostVarianceTotals {
  bidTotalCents: number;
  actualTotalCents: number;
  varianceCents: number;
  variancePercent: number | null;
}

export function rollupCostVariance(rows: CostVarianceRow[]): CostVarianceTotals {
  const bidTotalCents = rows.reduce((s, r) => s + r.bidTotalCents, 0);
  const actualTotalCents = rows.reduce((s, r) => s + r.actualTotalCents, 0);
  const varianceCents = bidTotalCents - actualTotalCents;
  const variancePercent = bidTotalCents > 0 ? varianceCents / bidTotalCents : null;
  return { bidTotalCents, actualTotalCents, varianceCents, variancePercent };
}
