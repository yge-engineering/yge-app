// Per-customer per-month billing matrix.
//
// Plain English: a row per customer, a list of yyyy-mm cells
// containing billed cents + invoice count for that month. Useful
// for spotting billing droughts on long-running customer
// relationships ('Caltrans hasn't been billed in 3 months — is
// this contract paused or did we forget?').
//
// Different from customer-revenue-trend (per-customer trend
// classifier) and monthly-billing (portfolio). This is the
// flat matrix view.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerMonthCell {
  month: string;
  billedCents: number;
  invoiceCount: number;
}

export interface CustomerMonthRow {
  customerName: string;
  totalCells: number;
  totalBilledCents: number;
  totalInvoices: number;
  /** Cells with billing, ascending by month. */
  cells: CustomerMonthCell[];
  /** Latest cell's month, or null if none. */
  lastBilledMonth: string | null;
}

export interface CustomerMonthMatrixRollup {
  customersConsidered: number;
  monthsCovered: number;
  totalBilledCents: number;
}

export interface CustomerMonthMatrixInputs {
  arInvoices: ArInvoice[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerMonthMatrix(
  inputs: CustomerMonthMatrixInputs,
): {
  rollup: CustomerMonthMatrixRollup;
  rows: CustomerMonthRow[];
} {
  type Acc = {
    display: string;
    cells: Map<string, CustomerMonthCell>;
  };
  const accs = new Map<string, Acc>();
  const monthsSet = new Set<string>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    const month = inv.createdAt.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    let total = 0;
    for (const li of inv.lineItems) total += li.lineTotalCents;
    const key = canonicalize(inv.customerName);
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      cells: new Map<string, CustomerMonthCell>(),
    };
    const cell = acc.cells.get(month) ?? { month, billedCents: 0, invoiceCount: 0 };
    cell.billedCents += total;
    cell.invoiceCount += 1;
    acc.cells.set(month, cell);
    accs.set(key, acc);
    monthsSet.add(month);
  }

  let totalBilled = 0;

  const rows: CustomerMonthRow[] = [];
  for (const acc of accs.values()) {
    const cells = Array.from(acc.cells.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    let billed = 0;
    let invs = 0;
    for (const c of cells) {
      billed += c.billedCents;
      invs += c.invoiceCount;
    }
    const lastMonth = cells.length === 0 ? null : (cells[cells.length - 1]?.month ?? null);
    rows.push({
      customerName: acc.display,
      totalCells: cells.length,
      totalBilledCents: billed,
      totalInvoices: invs,
      cells,
      lastBilledMonth: lastMonth,
    });
    totalBilled += billed;
  }

  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  return {
    rollup: {
      customersConsidered: rows.length,
      monthsCovered: monthsSet.size,
      totalBilledCents: totalBilled,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
