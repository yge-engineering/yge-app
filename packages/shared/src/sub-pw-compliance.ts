// Subcontractor public-works compliance check.
//
// Plain English: California public works (PCC §4104, DIR §1725.5)
// require every sub working on the job to have a current CSLB
// license number AND a current DIR public-works contractor
// registration number. If we pay a sub on a PUBLIC_WORKS job
// without those records, two things happen:
//   - YGE can be penalized by DIR ($100/day per worker, §1777.7)
//   - The agency can withhold our progress payment until cured
//
// This walks AP invoices on PUBLIC_WORKS jobs, joins each to the
// sub's vendor record, and surfaces any sub paid on PW work that
// is missing CSLB or DIR registration. Drives "fix this before
// the next CPR submission" view.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';
import type { Vendor } from './vendor';

export type PwComplianceGap =
  | 'NO_CSLB'        // CSLB license missing
  | 'NO_DIR'         // DIR registration missing
  | 'BOTH_MISSING';  // both missing

export interface PwComplianceRow {
  vendorId: string | null;
  vendorName: string;
  /** Distinct PUBLIC_WORKS jobIds the sub was paid on. */
  jobIds: string[];
  /** Sum of paidCents to this sub on PW jobs in the input set. */
  paidOnPwCents: number;
  /** Number of AP invoices on PW jobs to this sub. */
  invoiceCount: number;
  cslbOnFile: boolean;
  dirOnFile: boolean;
  gap: PwComplianceGap;
}

export interface PwComplianceRollup {
  subsConsidered: number;
  noCslbCount: number;
  noDirCount: number;
  bothMissingCount: number;
  /** Sum of paidOnPwCents across all flagged rows — total
   *  unsupported PW spend. */
  unsupportedPwCents: number;
}

export interface PwComplianceInputs {
  jobs: Pick<Job, 'id' | 'contractType'>[];
  vendors: Vendor[];
  apInvoices: ApInvoice[];
}

export function buildSubPwCompliance(inputs: PwComplianceInputs): {
  rollup: PwComplianceRollup;
  rows: PwComplianceRow[];
} {
  // Which jobs are public works?
  const pwJobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (j.contractType === 'PUBLIC_WORKS') pwJobIds.add(j.id);
  }

  // Vendor lookup by normalized name for AP join.
  const subs = inputs.vendors.filter((v) => v.kind === 'SUBCONTRACTOR');
  const byName = new Map<string, Vendor>();
  for (const v of subs) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  // Aggregate per vendor across PW invoices.
  type Bucket = {
    vendorId: string | null;
    vendorName: string;
    cslbOnFile: boolean;
    dirOnFile: boolean;
    paidOnPw: number;
    invoiceCount: number;
    jobIds: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const jobId = inv.jobId;
    if (!jobId || !pwJobIds.has(jobId)) continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue; // not a tracked sub — surfaced elsewhere

    const key = v.id;
    const b = buckets.get(key) ?? {
      vendorId: v.id,
      vendorName: v.dbaName ?? v.legalName,
      cslbOnFile: !!v.cslbLicense && v.cslbLicense.trim().length > 0,
      dirOnFile: !!v.dirRegistration && v.dirRegistration.trim().length > 0,
      paidOnPw: 0,
      invoiceCount: 0,
      jobIds: new Set<string>(),
    };
    b.paidOnPw += inv.paidCents;
    b.invoiceCount += 1;
    b.jobIds.add(jobId);
    buckets.set(key, b);
  }

  const rows: PwComplianceRow[] = [];
  let noCslb = 0;
  let noDir = 0;
  let bothMissing = 0;
  let unsupportedPw = 0;

  for (const b of buckets.values()) {
    if (b.cslbOnFile && b.dirOnFile) continue; // compliant — drop

    let gap: PwComplianceGap;
    if (!b.cslbOnFile && !b.dirOnFile) {
      gap = 'BOTH_MISSING';
      bothMissing += 1;
    } else if (!b.cslbOnFile) {
      gap = 'NO_CSLB';
      noCslb += 1;
    } else {
      gap = 'NO_DIR';
      noDir += 1;
    }
    unsupportedPw += b.paidOnPw;

    rows.push({
      vendorId: b.vendorId,
      vendorName: b.vendorName,
      jobIds: Array.from(b.jobIds).sort(),
      paidOnPwCents: b.paidOnPw,
      invoiceCount: b.invoiceCount,
      cslbOnFile: b.cslbOnFile,
      dirOnFile: b.dirOnFile,
      gap,
    });
  }

  // Worst (BOTH_MISSING) first, then by paid amount desc.
  const tierRank: Record<PwComplianceGap, number> = {
    BOTH_MISSING: 0,
    NO_DIR: 1,
    NO_CSLB: 2,
  };
  rows.sort((a, b) => {
    if (a.gap !== b.gap) return tierRank[a.gap] - tierRank[b.gap];
    return b.paidOnPwCents - a.paidOnPwCents;
  });

  return {
    rollup: {
      subsConsidered: rows.length,
      noCslbCount: noCslb,
      noDirCount: noDir,
      bothMissingCount: bothMissing,
      unsupportedPwCents: unsupportedPw,
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
