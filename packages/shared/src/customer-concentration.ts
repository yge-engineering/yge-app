// Customer revenue concentration analysis.
//
// Plain English: where does YGE's money come from? When 80% of
// revenue rides on one customer, "what happens if Cal Fire delays
// the next contract?" is a real conversation. This walks AR
// invoices in a date range and produces the concentration view.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerRevenueRow {
  customerName: string;
  /** Sum of totalCents across DRAFT-excluded invoices in the period. */
  billedCents: number;
  /** Sum of paidCents in the period. */
  collectedCents: number;
  invoiceCount: number;
  /** Distinct jobIds the customer was billed on. */
  jobCount: number;
  /** billed / period total. 0..1. */
  shareOfPeriod: number;
}

export interface CustomerConcentrationReport {
  start: string;
  end: string;
  totalBilledCents: number;
  totalCollectedCents: number;
  rows: CustomerRevenueRow[];

  /** Share of period billing represented by the top customer. */
  top1SharePct: number;
  /** Top 3 customers share. */
  top3SharePct: number;
  /** Top 5 customers share. */
  top5SharePct: number;

  /** Herfindahl-Hirschman Index across customers (sum of squared
   *  shares × 10000). 10000 = monopoly, near 0 = perfectly diffuse. */
  hhi: number;
}

export interface CustomerConcentrationInputs {
  start: string;
  end: string;
  arInvoices: ArInvoice[];
  /** When true, normalizes customerName so "Cal Fire" and
   *  "California Department of Forestry and Fire Protection" can be
   *  collided manually. Default: just trim+lowercase, no merging. */
  caseInsensitive?: boolean;
}

export function buildCustomerConcentration(
  inputs: CustomerConcentrationInputs,
): CustomerConcentrationReport {
  const { start, end, arInvoices } = inputs;
  const caseInsensitive = inputs.caseInsensitive !== false;

  type Bucket = {
    display: string;
    billed: number;
    collected: number;
    invoiceCount: number;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    if (inv.invoiceDate < start || inv.invoiceDate > end) continue;

    const raw = inv.customerName.trim();
    if (!raw) continue;
    const key = caseInsensitive ? raw.toLowerCase() : raw;
    const bucket =
      buckets.get(key) ??
      ({
        display: raw,
        billed: 0,
        collected: 0,
        invoiceCount: 0,
        jobs: new Set<string>(),
      } as Bucket);
    bucket.billed += inv.totalCents;
    bucket.collected += inv.paidCents;
    bucket.invoiceCount += 1;
    bucket.jobs.add(inv.jobId);
    buckets.set(key, bucket);
  }

  let totalBilledCents = 0;
  let totalCollectedCents = 0;
  for (const b of buckets.values()) {
    totalBilledCents += b.billed;
    totalCollectedCents += b.collected;
  }

  const rows: CustomerRevenueRow[] = [];
  for (const b of buckets.values()) {
    rows.push({
      customerName: b.display,
      billedCents: b.billed,
      collectedCents: b.collected,
      invoiceCount: b.invoiceCount,
      jobCount: b.jobs.size,
      shareOfPeriod:
        totalBilledCents === 0 ? 0 : b.billed / totalBilledCents,
    });
  }
  rows.sort((a, b) => b.billedCents - a.billedCents);

  const sumTopN = (n: number): number => {
    let s = 0;
    for (let i = 0; i < Math.min(n, rows.length); i += 1) {
      s += rows[i]!.billedCents;
    }
    return s;
  };

  const top1SharePct =
    totalBilledCents === 0 ? 0 : sumTopN(1) / totalBilledCents;
  const top3SharePct =
    totalBilledCents === 0 ? 0 : sumTopN(3) / totalBilledCents;
  const top5SharePct =
    totalBilledCents === 0 ? 0 : sumTopN(5) / totalBilledCents;

  // HHI: sum of squared shares × 10000.
  let hhi = 0;
  for (const r of rows) {
    hhi += Math.pow(r.shareOfPeriod, 2);
  }
  hhi = Math.round(hhi * 10_000);

  return {
    start,
    end,
    totalBilledCents,
    totalCollectedCents,
    rows,
    top1SharePct,
    top3SharePct,
    top5SharePct,
    hhi,
  };
}
