// Per-job revenue source mix.
//
// Plain English: every AR invoice line carries a "kind" — LABOR,
// EQUIPMENT, MATERIAL, SUBCONTRACT, OTHER. Across all the AR
// invoices on a job, we can see whether the project's revenue is
// coming mostly from labor (T&M-style work), equipment-heavy work
// (rentals), material pass-throughs (markup-thin), or sub
// passthroughs (no margin to YGE). Drives the "where's the money
// on this job?" understanding before we bid the next one of the
// same shape.
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceLineKind } from './ar-invoice';
import type { Job } from './job';

export interface JobRevenueMixRow {
  jobId: string;
  projectName: string;
  totalBilledCents: number;
  laborCents: number;
  equipmentCents: number;
  materialCents: number;
  subcontractCents: number;
  otherCents: number;
  /** Top revenue source. Null when totalBilled is 0. */
  topKind: ArInvoiceLineKind | null;
  topKindSharePct: number;
  /** True iff topKindSharePct > 0.7 — revenue heavily concentrated. */
  concentrated: boolean;
}

export interface JobRevenueMixRollup {
  jobsConsidered: number;
  totalBilledCents: number;
  totalByKind: Record<ArInvoiceLineKind, number>;
  concentratedJobs: number;
}

export interface JobRevenueMixInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arInvoices: ArInvoice[];
  /** When false (default), only AWARDED jobs counted. */
  includeAllStatuses?: boolean;
}

const KIND_KEYS: ArInvoiceLineKind[] = [
  'LABOR',
  'EQUIPMENT',
  'MATERIAL',
  'SUBCONTRACT',
  'OTHER',
];

export function buildJobRevenueMix(inputs: JobRevenueMixInputs): {
  rollup: JobRevenueMixRollup;
  rows: JobRevenueMixRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Aggregate AR line totals per job per kind, skipping DRAFT + WRITTEN_OFF.
  const byJob = new Map<string, Map<ArInvoiceLineKind, number>>();
  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    const m = byJob.get(inv.jobId) ?? new Map<ArInvoiceLineKind, number>();
    for (const li of inv.lineItems ?? []) {
      m.set(li.kind, (m.get(li.kind) ?? 0) + li.lineTotalCents);
    }
    byJob.set(inv.jobId, m);
  }

  const rows: JobRevenueMixRow[] = [];
  const grandByKind: Record<ArInvoiceLineKind, number> = {
    LABOR: 0,
    EQUIPMENT: 0,
    MATERIAL: 0,
    SUBCONTRACT: 0,
    OTHER: 0,
  };
  let grandTotal = 0;
  let concentratedCount = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const m = byJob.get(j.id) ?? new Map<ArInvoiceLineKind, number>();
    let total = 0;
    for (const k of KIND_KEYS) total += m.get(k) ?? 0;

    let topKind: ArInvoiceLineKind | null = null;
    let topAmount = 0;
    for (const k of KIND_KEYS) {
      const v = m.get(k) ?? 0;
      if (v > topAmount) {
        topAmount = v;
        topKind = k;
      }
    }
    const topShare = total === 0 ? 0 : topAmount / total;
    const concentrated = topShare > 0.7;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalBilledCents: total,
      laborCents: m.get('LABOR') ?? 0,
      equipmentCents: m.get('EQUIPMENT') ?? 0,
      materialCents: m.get('MATERIAL') ?? 0,
      subcontractCents: m.get('SUBCONTRACT') ?? 0,
      otherCents: m.get('OTHER') ?? 0,
      topKind: total === 0 ? null : topKind,
      topKindSharePct: round4(topShare),
      concentrated,
    });

    grandTotal += total;
    for (const k of KIND_KEYS) grandByKind[k] += m.get(k) ?? 0;
    if (concentrated) concentratedCount += 1;
  }

  // Highest-billed first.
  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalBilledCents: grandTotal,
      totalByKind: grandByKind,
      concentratedJobs: concentratedCount,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
