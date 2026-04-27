// Backup-withholding alert (IRS 24% rule).
//
// Plain English: when a 1099-reportable vendor has been paid $600+
// in a calendar year and we still don't have a W-9 (or have one
// but no tax-id captured), the IRS requires us to BACKUP-WITHHOLD
// 24% on every future payment until they give us a TIN. This walks
// the vendor master + AP YTD spend and surfaces the vendors we
// need to either get the W-9 from or start withholding 24% on.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';
import { vendorW9Current } from './vendor';

export const BACKUP_WITHHOLDING_RATE = 0.24;

export type BackupWithholdingReason =
  | 'NO_W9'        // W-9 not on file at all
  | 'STALE_W9'     // W-9 on file but >3 years old
  | 'NO_TAX_ID';   // W-9 on file but taxId field empty

export interface BackupWithholdingRow {
  vendorId: string;
  vendorName: string;
  ytdPaidCents: number;
  reason: BackupWithholdingReason;
  /** 24% of YTD spend — what we should have backup-withheld. */
  withholdingExposureCents: number;
  /** Number of AP payments in the year. */
  paymentCount: number;
}

export interface BackupWithholdingReport {
  asOf: string;
  year: number;
  thresholdCents: number;
  totalExposureCents: number;
  rows: BackupWithholdingRow[];
}

export interface BackupWithholdingInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  /** Year for YTD sums. Defaults to year of asOf. */
  year?: number;
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  /** Default $600 IRS 1099-NEC threshold. */
  thresholdCents?: number;
}

export function buildBackupWithholdingAlert(
  inputs: BackupWithholdingInputs,
): BackupWithholdingReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const year = inputs.year ?? Number(asOf.slice(0, 4));
  const thresholdCents = inputs.thresholdCents ?? 600_00;
  const refNow = new Date(`${asOf}T00:00:00Z`);

  // Map vendors by normalized name so we can match AP invoices.
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  const ytdPaidByVendorId = new Map<string, { paid: number; count: number }>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.invoiceDate.startsWith(`${year}-`)) continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue;
    const cur = ytdPaidByVendorId.get(v.id) ?? { paid: 0, count: 0 };
    cur.paid += inv.paidCents;
    if (inv.paidCents > 0) cur.count += 1;
    ytdPaidByVendorId.set(v.id, cur);
  }

  const rows: BackupWithholdingRow[] = [];
  let totalExposure = 0;
  for (const v of inputs.vendors) {
    if (!v.is1099Reportable) continue;
    const ytd = ytdPaidByVendorId.get(v.id) ?? { paid: 0, count: 0 };
    if (ytd.paid < thresholdCents) continue;

    const w9Current = vendorW9Current(v, refNow);
    let reason: BackupWithholdingReason | null = null;
    if (!v.w9OnFile) reason = 'NO_W9';
    else if (!w9Current) reason = 'STALE_W9';
    else if (!v.taxId || v.taxId.trim().length === 0) reason = 'NO_TAX_ID';
    if (!reason) continue;

    const exposure = Math.round(ytd.paid * BACKUP_WITHHOLDING_RATE);
    rows.push({
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      ytdPaidCents: ytd.paid,
      reason,
      withholdingExposureCents: exposure,
      paymentCount: ytd.count,
    });
    totalExposure += exposure;
  }

  // Highest exposure first.
  rows.sort((a, b) => b.withholdingExposureCents - a.withholdingExposureCents);

  return {
    asOf,
    year,
    thresholdCents,
    totalExposureCents: totalExposure,
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
