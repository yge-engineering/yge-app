// Customer-anchored per-job AR/AP year-over-year detail.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job with prior + current AR billed cents
// and AP billed cents, plus the year-over-year deltas. Drives
// "which jobs grew or shrank" customer reviews.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

export interface CustomerJobDetailYoyRow {
  jobId: string;
  projectName: string;
  priorArBilledCents: number;
  priorApBilledCents: number;
  currentArBilledCents: number;
  currentApBilledCents: number;
  arDelta: number;
  apDelta: number;
}

export interface CustomerJobDetailYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  rows: CustomerJobDetailYoyRow[];
}

export interface CustomerJobDetailYoyInputs {
  customerName: string;
  jobs: Job[];
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerJobDetailYoy(inputs: CustomerJobDetailYoyInputs): CustomerJobDetailYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = inputs.jobs.filter((j) => norm(j.ownerAgency) === target);
  const customerJobIds = new Set(customerJobs.map((j) => j.id));
  const projectNames = new Map<string, string>();
  for (const j of customerJobs) projectNames.set(j.id, j.projectName);

  type Acc = {
    priorAr: number;
    currentAr: number;
    priorAp: number;
    currentAp: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { priorAr: 0, currentAr: 0, priorAp: 0, currentAp: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inv of inputs.arInvoices) {
    if (!customerJobIds.has(inv.jobId)) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    if (year === priorYear) getAcc(inv.jobId).priorAr += inv.totalCents ?? 0;
    else if (year === inputs.currentYear) getAcc(inv.jobId).currentAr += inv.totalCents ?? 0;
  }
  for (const inv of inputs.apInvoices) {
    if (!inv.jobId || !customerJobIds.has(inv.jobId)) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    if (year === priorYear) getAcc(inv.jobId).priorAp += inv.totalCents ?? 0;
    else if (year === inputs.currentYear) getAcc(inv.jobId).currentAp += inv.totalCents ?? 0;
  }

  const rows: CustomerJobDetailYoyRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      projectName: projectNames.get(jobId) ?? jobId,
      priorArBilledCents: a.priorAr,
      priorApBilledCents: a.priorAp,
      currentArBilledCents: a.currentAr,
      currentApBilledCents: a.currentAp,
      arDelta: a.currentAr - a.priorAr,
      apDelta: a.currentAp - a.priorAp,
    }))
    .sort((a, b) => Math.abs(b.arDelta) - Math.abs(a.arDelta) || a.projectName.localeCompare(b.projectName));

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    rows,
  };
}
