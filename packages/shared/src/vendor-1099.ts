// Vendor 1099-NEC year-end report.
//
// IRS rule (2024+ thresholds, current as of writing): a 1099-NEC must
// be filed for every non-corporate vendor paid >= $600 in a calendar
// year for services rendered. Materials-only payments are excluded
// (we treat 1099-Reportable as a per-vendor flag and trust Brook's
// classification on the vendor record).
//
// Pure derivation. For each vendor with `is1099Reportable=true` and at
// least one non-voided AP payment in the year, sums the year-to-date
// total and flags:
//   - over-threshold vendors missing a current W-9
//   - over-threshold vendors missing a tax ID
//
// Drives the year-end 1099-NEC filing pack the bookkeeper sends to
// the CPA in January.

import { type ApPayment } from './ap-payment';
import {
  type Vendor,
  vendorW9Current,
} from './vendor';

/** Default 1099-NEC reporting threshold in cents. IRS sets this; the
 *  caller can override if Congress moves it. */
export const DEFAULT_1099_NEC_THRESHOLD_CENTS = 600_00;

export interface Vendor1099Row {
  /** Matched Vendor record id, if any. Null when the AP payment's
   *  vendorName doesn't line up with any Vendor master row. */
  vendorId: string | null;
  /** Display name. Vendor master `legalName` when matched, else the
   *  free-form name on the AP payment. */
  vendorName: string;
  /** True iff Brook flagged this vendor as 1099-reportable on the
   *  Vendor master record. */
  is1099Reportable: boolean;
  /** Total non-voided AP payments to this vendor in the year (cents). */
  paidYtdCents: number;
  /** True iff paidYtdCents >= threshold. */
  overThreshold: boolean;
  /** True iff over-threshold AND vendor's W-9 isn't current. The
   *  blocker for filing — the IRS wants the EIN on the 1099. */
  missingCurrentW9: boolean;
  /** True iff over-threshold AND vendor has no tax ID recorded. */
  missingTaxId: boolean;
  /** Number of payments this year. */
  paymentCount: number;
}

export interface Vendor1099Report {
  year: number;
  thresholdCents: number;
  rows: Vendor1099Row[];
  /** Vendors whose YTD total exceeds the threshold. */
  reportableCount: number;
  /** Subset of reportable vendors blocked on a current W-9. */
  missingW9Count: number;
  totalReportableCents: number;
}

export interface Vendor1099Inputs {
  year: number;
  vendors: Vendor[];
  payments: ApPayment[];
  thresholdCents?: number;
  asOf?: Date;
}

/** Build the year-end 1099 report. */
export function buildVendor1099Report(inputs: Vendor1099Inputs): Vendor1099Report {
  const { year, vendors, payments } = inputs;
  const thresholdCents = inputs.thresholdCents ?? DEFAULT_1099_NEC_THRESHOLD_CENTS;
  const asOf = inputs.asOf ?? new Date();

  // Filter payments to the year + non-voided.
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const inYear = payments.filter(
    (p) => !p.voided && p.paidOn >= yearStart && p.paidOn <= yearEnd,
  );

  // Aggregate by normalized vendor name.
  interface Bucket {
    name: string;
    paidYtdCents: number;
    paymentCount: number;
  }
  const buckets = new Map<string, Bucket>();
  for (const p of inYear) {
    const key = normalizeVendorName(p.vendorName);
    if (!key) continue;
    const cur = buckets.get(key) ?? {
      name: p.vendorName,
      paidYtdCents: 0,
      paymentCount: 0,
    };
    cur.paidYtdCents += p.amountCents;
    cur.paymentCount += 1;
    buckets.set(key, cur);
  }

  // Index vendors by normalized legal + DBA name to catch both ways
  // an AP payment might have spelled them.
  const vendorByName = new Map<string, Vendor>();
  for (const v of vendors) {
    const legalKey = normalizeVendorName(v.legalName);
    if (legalKey && !vendorByName.has(legalKey)) vendorByName.set(legalKey, v);
    if (v.dbaName) {
      const dbaKey = normalizeVendorName(v.dbaName);
      if (dbaKey && !vendorByName.has(dbaKey)) vendorByName.set(dbaKey, v);
    }
  }

  const rows: Vendor1099Row[] = [];
  for (const [key, b] of buckets) {
    const v = vendorByName.get(key) ?? null;
    const is1099Reportable = v?.is1099Reportable ?? false;
    const overThreshold = b.paidYtdCents >= thresholdCents;
    const w9Current = v ? vendorW9Current(v, asOf) : false;
    rows.push({
      vendorId: v?.id ?? null,
      vendorName: v?.legalName ?? b.name,
      is1099Reportable,
      paidYtdCents: b.paidYtdCents,
      overThreshold,
      missingCurrentW9: overThreshold && is1099Reportable && !w9Current,
      missingTaxId:
        overThreshold &&
        is1099Reportable &&
        (!v?.taxId || v.taxId.trim().length === 0),
      paymentCount: b.paymentCount,
    });
  }

  rows.sort((a, b) => b.paidYtdCents - a.paidYtdCents);

  const reportableRows = rows.filter((r) => r.is1099Reportable && r.overThreshold);
  return {
    year,
    thresholdCents,
    rows,
    reportableCount: reportableRows.length,
    missingW9Count: rows.filter((r) => r.missingCurrentW9).length,
    totalReportableCents: reportableRows.reduce((s, r) => s + r.paidYtdCents, 0),
  };
}

/** Normalize vendor names so "Acme Concrete LLC" and "Acme Concrete,
 *  LLC" map to the same bucket. Strips punctuation, lowercases,
 *  collapses whitespace, drops the legal-suffix noise. */
function normalizeVendorName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
