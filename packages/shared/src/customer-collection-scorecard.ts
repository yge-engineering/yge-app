// Per-customer collection scorecard.
//
// Plain English: customer-payment-velocity tells us how fast each
// customer pays the invoices they DO pay. This module fills the
// other half — the rate at which they pay at all. Invoiced vs.
// collected vs. written-off vs. currently outstanding for each
// customer over a date window.
//
// Drives:
//   - credit decisions: "do we extend Net-60 to this customer?"
//   - account triage: "Brook should call Slow County before
//     opening another job for them"
//   - bid-weighting: discount future bids from low-collection
//     customers, or just avoid the agency
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerCollectionRow {
  customerName: string;
  invoiceCount: number;
  invoicedCents: number;
  collectedCents: number;
  writtenOffCents: number;
  outstandingCents: number;
  /** collected / invoiced. 0..1. */
  collectionRate: number;
  /** writtenOff / invoiced. 0..1. */
  writeOffRate: number;
}

export interface CollectionRollup {
  customersConsidered: number;
  totalInvoicedCents: number;
  totalCollectedCents: number;
  totalWrittenOffCents: number;
  totalOutstandingCents: number;
  /** Customers with collectionRate < 0.7 — credit-risk list. */
  lowCollectionCustomers: number;
}

export interface CollectionInputs {
  /** Optional yyyy-mm-dd window applied against invoiceDate. */
  fromDate?: string;
  toDate?: string;
  arInvoices: ArInvoice[];
  /** When true (default), case-insensitively merge customer
   *  name variants. */
  caseInsensitive?: boolean;
}

export function buildCustomerCollectionScorecard(
  inputs: CollectionInputs,
): {
  rollup: CollectionRollup;
  rows: CustomerCollectionRow[];
} {
  const caseInsensitive = inputs.caseInsensitive !== false;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    customerName: string;
    invoiceCount: number;
    invoiced: number;
    collected: number;
    writtenOff: number;
    outstanding: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    if (!inRange(inv.invoiceDate)) continue;

    const key = caseInsensitive
      ? inv.customerName.trim().toLowerCase()
      : inv.customerName.trim();
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      invoiceCount: 0,
      invoiced: 0,
      collected: 0,
      writtenOff: 0,
      outstanding: 0,
    };
    b.invoiceCount += 1;
    b.invoiced += inv.totalCents;
    if (inv.status === 'WRITTEN_OFF') {
      // Written-off uncollected portion contributes to write-off.
      const wo = Math.max(0, inv.totalCents - inv.paidCents);
      b.writtenOff += wo;
      b.collected += inv.paidCents;
    } else {
      b.collected += inv.paidCents;
      const open = Math.max(0, inv.totalCents - inv.paidCents);
      b.outstanding += open;
    }
    buckets.set(key, b);
  }

  const rows: CustomerCollectionRow[] = [];
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalWrittenOff = 0;
  let totalOutstanding = 0;
  let lowCollection = 0;

  for (const b of buckets.values()) {
    const collectionRate = b.invoiced === 0 ? 0 : b.collected / b.invoiced;
    const writeOffRate = b.invoiced === 0 ? 0 : b.writtenOff / b.invoiced;
    rows.push({
      customerName: b.customerName,
      invoiceCount: b.invoiceCount,
      invoicedCents: b.invoiced,
      collectedCents: b.collected,
      writtenOffCents: b.writtenOff,
      outstandingCents: b.outstanding,
      collectionRate: round4(collectionRate),
      writeOffRate: round4(writeOffRate),
    });
    totalInvoiced += b.invoiced;
    totalCollected += b.collected;
    totalWrittenOff += b.writtenOff;
    totalOutstanding += b.outstanding;
    if (collectionRate < 0.7 && b.invoiced > 0) lowCollection += 1;
  }

  // Lowest collection rate first — credit-risk list at top.
  rows.sort((a, b) => a.collectionRate - b.collectionRate);

  return {
    rollup: {
      customersConsidered: rows.length,
      totalInvoicedCents: totalInvoiced,
      totalCollectedCents: totalCollected,
      totalWrittenOffCents: totalWrittenOff,
      totalOutstandingCents: totalOutstanding,
      lowCollectionCustomers: lowCollection,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
