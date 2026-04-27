// Vendor on-hold AP exposure.
//
// Plain English: a vendor gets put on hold when there's a billing
// dispute, a quality issue, or a credit problem. The hold flag
// says "don't pay them more until this is resolved." But the AP
// queue is a different process from the vendor master, so the
// flag can drift out of sync. This module surfaces the gap:
//
//   - on-hold vendors with PENDING/APPROVED AP invoices that
//     are about to flow into the next check run
//   - on-hold vendors with PAID invoices since the hold went on
//     (we paid them anyway — needs a stop-pay or a clawback
//     conversation)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export interface OnHoldVendorRow {
  vendorId: string;
  vendorName: string;
  onHoldReason: string | null;
  /** PENDING + APPROVED unpaid balance — money about to leave. */
  unpaidExposureCents: number;
  unpaidInvoiceCount: number;
  /** Sum of paidCents on PAID invoices in the recent window —
   *  the "we paid despite the hold" gap. */
  recentPaidCents: number;
  recentPaidInvoiceCount: number;
  /** Distinct jobs the vendor was on. */
  jobsTouched: number;
}

export interface OnHoldVendorRollup {
  onHoldVendorsConsidered: number;
  totalUnpaidExposureCents: number;
  totalRecentPaidCents: number;
}

export interface OnHoldVendorInputs {
  asOf?: string;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** yyyy-mm-dd start of the "recent paid" lookback window.
   *  Defaults to YTD of asOf. */
  recentSince?: string;
}

export function buildVendorOnHoldExposure(
  inputs: OnHoldVendorInputs,
): {
  rollup: OnHoldVendorRollup;
  rows: OnHoldVendorRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const recentSince = inputs.recentSince ?? `${asOf.slice(0, 4)}-01-01`;

  // Build a name lookup including DBA aliases.
  const heldVendors = inputs.vendors.filter((v) => v.onHold === true);
  const byName = new Map<string, Vendor>();
  for (const v of heldVendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  // Aggregate AP per held vendor.
  type Bucket = {
    vendorId: string;
    vendorName: string;
    onHoldReason: string | null;
    unpaid: number;
    unpaidCount: number;
    paid: number;
    paidCount: number;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue;

    const b = buckets.get(v.id) ?? {
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      onHoldReason: v.onHoldReason ?? null,
      unpaid: 0,
      unpaidCount: 0,
      paid: 0,
      paidCount: 0,
      jobs: new Set<string>(),
    };

    if (inv.jobId) b.jobs.add(inv.jobId);

    if (inv.status === 'PENDING' || inv.status === 'APPROVED') {
      const open = Math.max(0, inv.totalCents - inv.paidCents);
      if (open > 0) {
        b.unpaid += open;
        b.unpaidCount += 1;
      }
    }
    if (
      inv.status === 'PAID' &&
      inv.invoiceDate >= recentSince &&
      inv.invoiceDate <= asOf &&
      inv.paidCents > 0
    ) {
      b.paid += inv.paidCents;
      b.paidCount += 1;
    }
    buckets.set(v.id, b);
  }

  // Surface every held vendor, even ones with no AP activity, so
  // the count of on-hold vendors is accurate.
  for (const v of heldVendors) {
    if (!buckets.has(v.id)) {
      buckets.set(v.id, {
        vendorId: v.id,
        vendorName: v.dbaName ?? v.legalName,
        onHoldReason: v.onHoldReason ?? null,
        unpaid: 0,
        unpaidCount: 0,
        paid: 0,
        paidCount: 0,
        jobs: new Set<string>(),
      });
    }
  }

  const rows: OnHoldVendorRow[] = Array.from(buckets.values()).map((b) => ({
    vendorId: b.vendorId,
    vendorName: b.vendorName,
    onHoldReason: b.onHoldReason,
    unpaidExposureCents: b.unpaid,
    unpaidInvoiceCount: b.unpaidCount,
    recentPaidCents: b.paid,
    recentPaidInvoiceCount: b.paidCount,
    jobsTouched: b.jobs.size,
  }));

  // Highest unpaid exposure first; tied by recent paid desc.
  rows.sort((a, b) => {
    if (a.unpaidExposureCents !== b.unpaidExposureCents) {
      return b.unpaidExposureCents - a.unpaidExposureCents;
    }
    return b.recentPaidCents - a.recentPaidCents;
  });

  let totalUnpaid = 0;
  let totalRecentPaid = 0;
  for (const r of rows) {
    totalUnpaid += r.unpaidExposureCents;
    totalRecentPaid += r.recentPaidCents;
  }

  return {
    rollup: {
      onHoldVendorsConsidered: rows.length,
      totalUnpaidExposureCents: totalUnpaid,
      totalRecentPaidCents: totalRecentPaid,
    },
    rows,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
