// Subcontractor performance scorecard.
//
// Plain English: which subs do we use, how much do we pay them, and
// are they costing us callbacks? This walks the vendor master,
// filtered to SUBCONTRACTOR, and rolls up:
//   - Total $ paid (from AP invoices)
//   - Distinct jobs used on
//   - Last invoice date
//   - Open punch items where the sub is responsibleParty
//     (callback exposure — money YGE has already spent that the sub
//     still owes us back as a fix)
//   - Closed punch-item count
//
// Pure derivation. No persisted records. Drives:
//   - "Do we keep using this sub?" decision
//   - §4104 prequal packet input
//   - Concentration risk per scope

import type { ApInvoice } from './ap-invoice';
import type { PunchItem } from './punch-list';
import type { Vendor } from './vendor';
import { vendorCoiCurrent } from './vendor';

export interface SubScorecardRow {
  vendorId: string;
  vendorName: string;

  /** Total $ paid to this sub across all non-DRAFT, non-REJECTED AP
   *  invoices in the input set. */
  totalSpendCents: number;
  /** Sum of paidCents — what's gone out the door. */
  totalPaidCents: number;
  /** Distinct jobIds this sub has billed on. */
  jobCount: number;
  /** Number of AP invoices on file for this sub. */
  invoiceCount: number;
  /** Most recent AP invoiceDate for this sub. Null when no invoices. */
  lastInvoiceOn: string | null;

  /** Open punch items (OPEN, IN_PROGRESS, DISPUTED) where this sub
   *  is responsibleParty / responsibleVendorId. */
  openPunchItems: number;
  /** Closed punch items (CLOSED, WAIVED) where this sub was on the
   *  hook. */
  closedPunchItems: number;
  /** openPunchItems + closedPunchItems. */
  totalPunchItems: number;
  /** Best-guess callback rate: closed+open punch items per job
   *  worked. Higher = more rework. */
  callbacksPerJob: number;

  /** True iff the sub's COI on file is current as of `asOf`. */
  coiCurrent: boolean;
}

export interface SubScorecardRollup {
  subCount: number;
  totalSpendCents: number;
  /** Vendors with current COI / vendors with any spend. */
  coiCurrentRate: number;
  /** Top 5 sub spend / total sub spend. */
  top5SharePct: number;
}

export interface SubScorecardInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). Used for COI freshness. */
  asOf?: string;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  punchItems: PunchItem[];
}

export function buildSubScorecard(inputs: SubScorecardInputs): {
  rows: SubScorecardRow[];
  rollup: SubScorecardRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const subs = inputs.vendors.filter((v) => v.kind === 'SUBCONTRACTOR');
  const subById = new Map<string, Vendor>();
  const subByNormalizedName = new Map<string, Vendor>();
  for (const v of subs) {
    subById.set(v.id, v);
    const display = v.dbaName ?? v.legalName;
    subByNormalizedName.set(normalize(display), v);
  }

  // Per-vendor accumulators.
  type Bucket = {
    spend: number;
    paid: number;
    jobs: Set<string>;
    invoiceCount: number;
    lastInvoiceOn: string | null;
    openPunch: number;
    closedPunch: number;
  };
  const buckets = new Map<string, Bucket>();
  function bucket(vendorId: string): Bucket {
    const cur =
      buckets.get(vendorId) ??
      ({
        spend: 0,
        paid: 0,
        jobs: new Set<string>(),
        invoiceCount: 0,
        lastInvoiceOn: null,
        openPunch: 0,
        closedPunch: 0,
      } as Bucket);
    buckets.set(vendorId, cur);
    return cur;
  }

  // Walk AP invoices. Match by vendorId field (when populated) or by
  // normalized vendorName.
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    let v: Vendor | undefined;
    const directId =
      typeof (inv as Record<string, unknown>).vendorId === 'string'
        ? (inv as { vendorId?: string }).vendorId
        : undefined;
    if (directId && subById.has(directId)) v = subById.get(directId);
    if (!v) v = subByNormalizedName.get(normalize(inv.vendorName));
    if (!v) continue;
    const b = bucket(v.id);
    b.spend += inv.totalCents;
    b.paid += inv.paidCents;
    b.invoiceCount += 1;
    if (inv.jobId) b.jobs.add(inv.jobId);
    if (
      !b.lastInvoiceOn ||
      inv.invoiceDate > b.lastInvoiceOn
    ) {
      b.lastInvoiceOn = inv.invoiceDate;
    }
  }

  // Walk punch items. Match by responsibleVendorId, then by
  // responsibleParty name.
  for (const p of inputs.punchItems) {
    let v: Vendor | undefined;
    if (p.responsibleVendorId && subById.has(p.responsibleVendorId)) {
      v = subById.get(p.responsibleVendorId);
    }
    if (!v && p.responsibleParty) {
      v = subByNormalizedName.get(normalize(p.responsibleParty));
    }
    if (!v) continue;
    const b = bucket(v.id);
    if (p.status === 'CLOSED' || p.status === 'WAIVED') {
      b.closedPunch += 1;
    } else {
      b.openPunch += 1;
    }
  }

  const rows: SubScorecardRow[] = [];
  for (const v of subs) {
    const b = buckets.get(v.id);
    if (!b) continue; // sub on the master but no activity yet — skip
    const totalPunch = b.openPunch + b.closedPunch;
    rows.push({
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      totalSpendCents: b.spend,
      totalPaidCents: b.paid,
      jobCount: b.jobs.size,
      invoiceCount: b.invoiceCount,
      lastInvoiceOn: b.lastInvoiceOn,
      openPunchItems: b.openPunch,
      closedPunchItems: b.closedPunch,
      totalPunchItems: totalPunch,
      callbacksPerJob:
        b.jobs.size === 0 ? 0 : totalPunch / b.jobs.size,
      coiCurrent: vendorCoiCurrent(v, refNow),
    });
  }

  // Sort: highest spend first.
  rows.sort((a, b) => b.totalSpendCents - a.totalSpendCents);

  // Rollup.
  const totalSpendCents = rows.reduce(
    (sum, r) => sum + r.totalSpendCents,
    0,
  );
  const coiCurrentCount = rows.filter((r) => r.coiCurrent).length;
  let top5 = 0;
  for (let i = 0; i < Math.min(5, rows.length); i += 1) {
    top5 += rows[i]!.totalSpendCents;
  }

  return {
    rows,
    rollup: {
      subCount: rows.length,
      totalSpendCents,
      coiCurrentRate: rows.length === 0 ? 0 : coiCurrentCount / rows.length,
      top5SharePct: totalSpendCents === 0 ? 0 : top5 / totalSpendCents,
    },
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
