// Per-job cost-code drill-down.
//
// Pure derivation. For a given job, walks every AP invoice line item,
// expense receipt, and time card entry that's tagged to the job and
// buckets the cost by `costCode`. Plus a per-cost-code total + an
// uncoded bucket so nothing falls through.
//
// Phase 1 surfaces actuals only. Budget-vs-actual lands when bid
// items grow a `costCode` field (Phase 2) — the API stays the same
// and `JobCostCodeRow.budgetCents` already accepts the budget side.

import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';
import type { DirClassification } from './employee';
import type { Expense } from './expense';
import { expenseReimbursableCents } from './expense';
import { reimbursementCents } from './mileage';
import type { MileageEntry } from './mileage';
import {
  type TimeCard,
  type TimeEntry,
  entryWorkedHours,
} from './time-card';

export const UNCODED_BUCKET = '(uncoded)';

export interface JobCostCodeRow {
  costCode: string;
  /** Always populated; falls back to UNCODED_BUCKET when no costCode
   *  was captured. */
  apCents: number;
  laborCents: number;
  expenseCents: number;
  mileageCents: number;
  totalActualCents: number;
  /** Optional budget — null when bid items haven't been cost-coded
   *  yet. */
  budgetCents: number | null;
  /** Variance = budget − actual. Positive = under budget, negative =
   *  over. Null when budget is null. */
  varianceCents: number | null;
  /** Variance % of budget. Null when budget is 0 or null. */
  variancePercent: number | null;
  /** Number of source rows behind this bucket (for the drill-in count). */
  sourceCount: number;
}

export interface JobCostBreakdown {
  jobId: string;
  rows: JobCostCodeRow[];
  totalActualCents: number;
  totalBudgetCents: number | null;
  /** True when at least one budget figure is set. */
  hasBudget: boolean;
}

export interface JobCostBreakdownInputs {
  jobId: string;
  apInvoices: ApInvoice[];
  expenses?: Expense[];
  timeCards?: TimeCard[];
  mileage?: MileageEntry[];
  /** Map of cost code → budget cents from the awarded estimate. Phase
   *  1: caller passes empty map (no budget). Phase 2: derives from
   *  PricedEstimate when bid items grow a costCode field. */
  budgetByCostCode?: Map<string, number>;
  /** Map of DirClassification → base cents/hr. Used to dollarize time
   *  card hours per cost code. Caller looks up from DIR rates. */
  laborRatesByClassification?: Map<DirClassification, number>;
  /** Map of employeeId → DirClassification so we can apply the right
   *  labor rate to a time-card entry. */
  classificationByEmployeeId?: Map<string, DirClassification>;
}

/** Build the breakdown. */
export function buildJobCostBreakdown(
  inputs: JobCostBreakdownInputs,
): JobCostBreakdown {
  const {
    jobId,
    apInvoices,
    expenses = [],
    timeCards = [],
    mileage = [],
    budgetByCostCode = new Map(),
    laborRatesByClassification = new Map(),
    classificationByEmployeeId = new Map(),
  } = inputs;

  interface Bucket {
    apCents: number;
    laborCents: number;
    expenseCents: number;
    mileageCents: number;
    sourceCount: number;
  }
  const buckets = new Map<string, Bucket>();
  function bucketFor(code: string): Bucket {
    const key = code.trim().length > 0 ? code.trim() : UNCODED_BUCKET;
    let b = buckets.get(key);
    if (!b) {
      b = { apCents: 0, laborCents: 0, expenseCents: 0, mileageCents: 0, sourceCount: 0 };
      buckets.set(key, b);
    }
    return b;
  }

  // AP — only count APPROVED + PAID invoices (matches WIP/job-profit).
  for (const ap of apInvoices) {
    if (ap.status !== 'APPROVED' && ap.status !== 'PAID') continue;
    if (ap.lineItems.length === 0) {
      // Header-only invoice coded to the job rolls into uncoded.
      if (ap.jobId === jobId) {
        const b = bucketFor(UNCODED_BUCKET);
        b.apCents += ap.totalCents;
        b.sourceCount += 1;
      }
      continue;
    }
    for (const line of ap.lineItems) {
      const lineJob = line.jobId ?? ap.jobId;
      if (lineJob !== jobId) continue;
      const b = bucketFor(line.costCode ?? UNCODED_BUCKET);
      b.apCents += line.lineTotalCents;
      b.sourceCount += 1;
    }
  }

  // Expense receipts — no costCode field on the schema, so all land
  // in the uncoded bucket.
  for (const e of expenses) {
    if (e.jobId !== jobId) continue;
    const reimb = expenseReimbursableCents(e);
    if (reimb <= 0) continue;
    const b = bucketFor(UNCODED_BUCKET);
    b.expenseCents += reimb;
    b.sourceCount += 1;
  }

  // Time card entries — sum hours per cost code, multiply by base
  // labor rate for the employee's classification.
  for (const card of timeCards) {
    const cls = classificationByEmployeeId.get(card.employeeId);
    const rate = cls ? laborRatesByClassification.get(cls) ?? 0 : 0;
    for (const e of card.entries as TimeEntry[]) {
      if (e.jobId !== jobId) continue;
      const hours = entryWorkedHours(e);
      if (hours <= 0) continue;
      const b = bucketFor(e.costCode ?? UNCODED_BUCKET);
      b.laborCents += Math.round(hours * rate);
      b.sourceCount += 1;
    }
  }

  // Mileage — no costCode field; lands in uncoded for this job.
  for (const m of mileage) {
    if (m.jobId !== jobId) continue;
    const reimb = reimbursementCents(m);
    if (reimb <= 0) continue;
    const b = bucketFor(UNCODED_BUCKET);
    b.mileageCents += reimb;
    b.sourceCount += 1;
  }

  // Inject budget-only rows for codes that have a budget but no actuals.
  for (const code of budgetByCostCode.keys()) {
    bucketFor(code);
  }

  const rows: JobCostCodeRow[] = [];
  let totalActualCents = 0;
  let totalBudgetCents = 0;
  let hasBudget = false;

  for (const [code, b] of buckets) {
    const totalActual = b.apCents + b.laborCents + b.expenseCents + b.mileageCents;
    totalActualCents += totalActual;
    const budgetCents = budgetByCostCode.has(code) ? budgetByCostCode.get(code)! : null;
    if (budgetCents != null) {
      totalBudgetCents += budgetCents;
      hasBudget = true;
    }
    const varianceCents = budgetCents == null ? null : budgetCents - totalActual;
    const variancePercent =
      budgetCents == null || budgetCents === 0
        ? null
        : (budgetCents - totalActual) / budgetCents;
    rows.push({
      costCode: code,
      apCents: b.apCents,
      laborCents: b.laborCents,
      expenseCents: b.expenseCents,
      mileageCents: b.mileageCents,
      totalActualCents: totalActual,
      budgetCents,
      varianceCents,
      variancePercent,
      sourceCount: b.sourceCount,
    });
  }

  // Sort: highest actual first, with the uncoded bucket pinned to the
  // bottom so it doesn't dominate.
  rows.sort((a, b) => {
    if (a.costCode === UNCODED_BUCKET && b.costCode !== UNCODED_BUCKET) return 1;
    if (b.costCode === UNCODED_BUCKET && a.costCode !== UNCODED_BUCKET) return -1;
    return b.totalActualCents - a.totalActualCents;
  });

  return {
    jobId,
    rows,
    totalActualCents,
    totalBudgetCents: hasBudget ? totalBudgetCents : null,
    hasBudget,
  };
}
