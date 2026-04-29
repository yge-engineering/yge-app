// Per (status, month) AP invoice volume + amount.
//
// Plain English: bucket AP invoices by (status, yyyy-mm of
// invoiceDate) — long-format. Useful for "draft pile growing
// each month" kind of bookkeeping-flow tracking.
//
// Per row: status, month, count, totalAmountCents.
//
// Sort: status asc, month asc.
//
// Different from ap-monthly-volume (per-month, all statuses
// together).
//
// Pure derivation. No persisted records.

import type { ApInvoice, ApInvoiceStatus } from './ap-invoice';

export interface ApByStatusMonthlyRow {
  status: ApInvoiceStatus;
  month: string;
  count: number;
  totalAmountCents: number;
}

export interface ApByStatusMonthlyRollup {
  statusesConsidered: number;
  monthsConsidered: number;
  totalInvoices: number;
  totalAmountCents: number;
}

export interface ApByStatusMonthlyInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildApByStatusMonthly(
  inputs: ApByStatusMonthlyInputs,
): {
  rollup: ApByStatusMonthlyRollup;
  rows: ApByStatusMonthlyRow[];
} {
  type Acc = {
    status: ApInvoiceStatus;
    month: string;
    count: number;
    cents: number;
  };
  const accs = new Map<string, Acc>();
  const statusSet = new Set<ApInvoiceStatus>();
  const monthSet = new Set<string>();
  let totalInvoices = 0;
  let totalCents = 0;

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${inv.status}|${month}`;
    const acc = accs.get(key) ?? {
      status: inv.status,
      month,
      count: 0,
      cents: 0,
    };
    acc.count += 1;
    acc.cents += inv.totalCents;
    accs.set(key, acc);
    statusSet.add(inv.status);
    monthSet.add(month);
    totalInvoices += 1;
    totalCents += inv.totalCents;
  }

  const rows: ApByStatusMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      status: acc.status,
      month: acc.month,
      count: acc.count,
      totalAmountCents: acc.cents,
    });
  }

  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      statusesConsidered: statusSet.size,
      monthsConsidered: monthSet.size,
      totalInvoices,
      totalAmountCents: totalCents,
    },
    rows,
  };
}
