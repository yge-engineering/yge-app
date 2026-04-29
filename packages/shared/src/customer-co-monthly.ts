// Per (customer, month) change-order activity.
//
// Plain English: join change orders to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// proposedAt). Counts proposed COs, approved COs, executed
// COs, sums amount cents, breaks down by reason
// (OWNER_DIRECTED / DESIGN_CHANGE / UNFORESEEN_CONDITION /
// etc.). Surfaces "Caltrans D2 has hammered us with COs in
// April — what changed?" patterns.
//
// Per row: customerName, month, proposedCount, approvedCount,
// executedCount, totalAmountCents, byReason.
//
// Sort: customerName asc, month asc.
//
// Different from co-density (per-job dollar density),
// co-origin-monthly (portfolio per month per origin),
// co-stale-tracker (chase list), customer-co-summary (per
// customer lifetime), job-co-by-month (per job per month).
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason } from './change-order';
import type { Job } from './job';

export interface CustomerCoMonthlyRow {
  customerName: string;
  month: string;
  proposedCount: number;
  approvedCount: number;
  executedCount: number;
  totalAmountCents: number;
  byReason: Partial<Record<ChangeOrderReason, number>>;
}

export interface CustomerCoMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalCos: number;
  totalAmountCents: number;
  unattributed: number;
}

export interface CustomerCoMonthlyInputs {
  changeOrders: ChangeOrder[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to proposedAt. */
  fromMonth?: string;
  toMonth?: string;
}

function sumAmount(co: ChangeOrder): number {
  let total = 0;
  for (const item of co.lineItems ?? []) {
    total += item.amountCents ?? 0;
  }
  return total;
}

export function buildCustomerCoMonthly(
  inputs: CustomerCoMonthlyInputs,
): {
  rollup: CustomerCoMonthlyRollup;
  rows: CustomerCoMonthlyRow[];
} {
  // Index Job → ownerAgency for the customer-name lookup.
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    proposedCount: number;
    approvedCount: number;
    executedCount: number;
    totalAmountCents: number;
    byReason: Map<ChangeOrderReason, number>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalCos = 0;
  let totalAmount = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const co of inputs.changeOrders) {
    if (!co.proposedAt) {
      unattributed += 1;
      continue;
    }
    const month = co.proposedAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(co.jobId);
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        proposedCount: 0,
        approvedCount: 0,
        executedCount: 0,
        totalAmountCents: 0,
        byReason: new Map(),
      };
      accs.set(key, a);
    }
    a.proposedCount += 1;
    if (co.approvedAt) a.approvedCount += 1;
    if (co.executedAt) a.executedCount += 1;
    const amt = sumAmount(co);
    a.totalAmountCents += amt;
    a.byReason.set(co.reason, (a.byReason.get(co.reason) ?? 0) + 1);

    customers.add(cKey);
    months.add(month);
    totalCos += 1;
    totalAmount += amt;
  }

  const rows: CustomerCoMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byReason: Partial<Record<ChangeOrderReason, number>> = {};
      for (const [k, v] of a.byReason) byReason[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        proposedCount: a.proposedCount,
        approvedCount: a.approvedCount,
        executedCount: a.executedCount,
        totalAmountCents: a.totalAmountCents,
        byReason,
      };
    })
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalCos,
      totalAmountCents: totalAmount,
      unattributed,
    },
    rows,
  };
}
