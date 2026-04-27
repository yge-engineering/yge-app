// Per-job equipment cost rollup.
//
// Plain English: equipment cost on a job has two parts:
//   - external rental from third parties (lives in AP invoices
//     against EQUIPMENT_RENTAL or TRUCKING vendor kinds)
//   - internal company iron used on the job (dispatched days *
//     a daily internal rate the caller passes in — the job
//     pays the company for the equipment use, even though it's
//     the same company)
//
// This module sums both into one number per job so the project
// manager + estimator can answer: did we run this job lean on
// iron, or did the equipment costs eat the margin?
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { Vendor } from './vendor';

export interface JobEquipmentCostRow {
  jobId: string;
  projectName: string;
  externalRentalCents: number;
  /** Days each company unit was dispatched to this job in window. */
  internalDispatchDays: number;
  /** internalDispatchDays * dailyRateCentsPerUnit. */
  internalEquipmentCents: number;
  totalEquipmentCents: number;
}

export interface JobEquipmentCostRollup {
  jobsConsidered: number;
  totalExternalCents: number;
  totalInternalCents: number;
  totalEquipmentCents: number;
}

export interface JobEquipmentCostInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  vendors: Vendor[];
  apInvoices: ApInvoice[];
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied against AP invoiceDate +
   *  dispatch scheduledFor. */
  fromDate?: string;
  toDate?: string;
  /** Internal company-iron daily rate (cents). Caller supplies
   *  the blended-or-category rate they want to use for charging
   *  the job. Default 500_00 (\$500/day) which is a reasonable
   *  blended rate for a heavy-civil fleet. */
  dailyRateCentsPerUnit?: number;
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobEquipmentCost(
  inputs: JobEquipmentCostInputs,
): {
  rollup: JobEquipmentCostRollup;
  rows: JobEquipmentCostRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const dailyRate = inputs.dailyRateCentsPerUnit ?? 500_00;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // Vendor lookup so we can detect EQUIPMENT_RENTAL and TRUCKING
  // AP lines as external equipment cost.
  const byName = new Map<string, Vendor>();
  for (const v of inputs.vendors) {
    byName.set(normalize(v.legalName), v);
    if (v.dbaName) byName.set(normalize(v.dbaName), v);
  }

  // External rental cost per job.
  const externalByJob = new Map<string, number>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    if (!inv.jobId) continue;
    if (!inRange(inv.invoiceDate)) continue;
    const v = byName.get(normalize(inv.vendorName));
    if (!v) continue;
    if (v.kind !== 'EQUIPMENT_RENTAL' && v.kind !== 'TRUCKING') continue;
    externalByJob.set(
      inv.jobId,
      (externalByJob.get(inv.jobId) ?? 0) + inv.totalCents,
    );
  }

  // Internal dispatch days per job — one per (jobId, scheduledFor,
  // equipment-key) combo (equipment-key = id or name fallback).
  const internalDaysByJob = new Map<string, number>();
  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (!inRange(d.scheduledFor)) continue;
    const seen = new Set<string>();
    for (const eq of d.equipment) {
      const key = eq.equipmentId ?? `name:${eq.name.trim().toLowerCase()}`;
      // dedupe within a single dispatch (same unit listed twice)
      if (seen.has(key)) continue;
      seen.add(key);
      internalDaysByJob.set(
        d.jobId,
        (internalDaysByJob.get(d.jobId) ?? 0) + 1,
      );
    }
  }

  const rows: JobEquipmentCostRow[] = [];
  let totalExt = 0;
  let totalInt = 0;
  let totalAll = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const ext = externalByJob.get(j.id) ?? 0;
    const days = internalDaysByJob.get(j.id) ?? 0;
    const intCents = days * dailyRate;
    const total = ext + intCents;
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      externalRentalCents: ext,
      internalDispatchDays: days,
      internalEquipmentCents: intCents,
      totalEquipmentCents: total,
    });
    totalExt += ext;
    totalInt += intCents;
    totalAll += total;
  }

  // Highest total equipment cost first.
  rows.sort((a, b) => b.totalEquipmentCents - a.totalEquipmentCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalExternalCents: totalExt,
      totalInternalCents: totalInt,
      totalEquipmentCents: totalAll,
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
