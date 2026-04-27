// Customer DSO (Days Sales Outstanding) tracker.
//
// Plain English: how long does each customer take to pay? Industry-
// standard collections KPI. Walks paid AR invoices and computes
// average days from invoiceDate to lastPaymentAt per customer.
// Surfaces slow payers — drives cash forecasting + which customers
// to chase first when collections gets behind.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface CustomerDsoRow {
  customerName: string;
  /** Number of paid (fully or partially) invoices in the period. */
  invoicesConsidered: number;
  /** Sum of totalCents on those invoices. */
  totalBilledCents: number;
  /** Sum of payments applied to those invoices. */
  totalCollectedCents: number;
  /** Mean days from invoiceDate to last payment date, weighted by
   *  totalCents on each invoice. */
  weightedDsoDays: number;
  /** Plain mean (every invoice equal weight). */
  meanDsoDays: number;
  /** Slowest single invoice in the period. */
  maxDsoDays: number;
}

export interface CustomerDsoReport {
  start: string;
  end: string;
  totalInvoicesConsidered: number;
  /** Weighted DSO across the whole portfolio. */
  blendedDsoDays: number;
  rows: CustomerDsoRow[];
}

export interface CustomerDsoInputs {
  /** ISO yyyy-mm-dd inclusive — bounds invoiceDate. */
  start: string;
  end: string;
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
}

export function buildCustomerDsoReport(
  inputs: CustomerDsoInputs,
): CustomerDsoReport {
  const { start, end, arInvoices, arPayments } = inputs;

  // Index payments by arInvoiceId, picking the LATEST receivedOn.
  const latestPaymentByInvoice = new Map<string, string>();
  const totalPaidByInvoice = new Map<string, number>();
  for (const p of arPayments) {
    const cur = latestPaymentByInvoice.get(p.arInvoiceId);
    if (!cur || p.receivedOn > cur) {
      latestPaymentByInvoice.set(p.arInvoiceId, p.receivedOn);
    }
    totalPaidByInvoice.set(
      p.arInvoiceId,
      (totalPaidByInvoice.get(p.arInvoiceId) ?? 0) + p.amountCents,
    );
  }

  type Bucket = {
    customerName: string;
    invoicesConsidered: number;
    totalBilled: number;
    totalCollected: number;
    weightedDsoNumerator: number;
    dsoSum: number;
    maxDso: number;
  };
  const byCustomer = new Map<string, Bucket>();

  for (const inv of arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    if (inv.invoiceDate < start || inv.invoiceDate > end) continue;

    const lastPaid = latestPaymentByInvoice.get(inv.id);
    if (!lastPaid) continue; // never paid → not in DSO universe
    const dso = Math.max(0, daysBetween(inv.invoiceDate, lastPaid));

    const collected = totalPaidByInvoice.get(inv.id) ?? inv.paidCents;
    const key = inv.customerName.trim().toLowerCase();
    const b =
      byCustomer.get(key) ??
      ({
        customerName: inv.customerName.trim(),
        invoicesConsidered: 0,
        totalBilled: 0,
        totalCollected: 0,
        weightedDsoNumerator: 0,
        dsoSum: 0,
        maxDso: 0,
      } as Bucket);
    b.invoicesConsidered += 1;
    b.totalBilled += inv.totalCents;
    b.totalCollected += collected;
    b.weightedDsoNumerator += dso * inv.totalCents;
    b.dsoSum += dso;
    if (dso > b.maxDso) b.maxDso = dso;
    byCustomer.set(key, b);
  }

  const rows: CustomerDsoRow[] = [];
  let blendedNumerator = 0;
  let blendedDenominator = 0;
  let totalInvoicesConsidered = 0;
  for (const [, b] of byCustomer) {
    rows.push({
      customerName: b.customerName,
      invoicesConsidered: b.invoicesConsidered,
      totalBilledCents: b.totalBilled,
      totalCollectedCents: b.totalCollected,
      weightedDsoDays:
        b.totalBilled === 0
          ? 0
          : Math.round(b.weightedDsoNumerator / b.totalBilled),
      meanDsoDays:
        b.invoicesConsidered === 0
          ? 0
          : Math.round(b.dsoSum / b.invoicesConsidered),
      maxDsoDays: b.maxDso,
    });
    blendedNumerator += b.weightedDsoNumerator;
    blendedDenominator += b.totalBilled;
    totalInvoicesConsidered += b.invoicesConsidered;
  }

  // Slowest payers first.
  rows.sort((a, b) => b.weightedDsoDays - a.weightedDsoDays);

  return {
    start,
    end,
    totalInvoicesConsidered,
    blendedDsoDays:
      blendedDenominator === 0
        ? 0
        : Math.round(blendedNumerator / blendedDenominator),
    rows,
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
