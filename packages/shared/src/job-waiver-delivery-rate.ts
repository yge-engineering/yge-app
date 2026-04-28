// Per-job lien-waiver delivery rate.
//
// Plain English: every AR payment YGE receives needs a matching
// statutory lien waiver delivered to the GC/owner. For each
// AWARDED job: count of payments received vs count of waivers
// delivered. The gap is the office bottleneck.
//
// Per row: paymentCount, waiverCount (any status),
// deliveredCount, deliveryRate, gap (paymentCount -
// deliveredCount). Sort puts the largest gap first.
//
// Different from lien-waiver-chase (per-payment chase list)
// and customer-waiver-cadence (per-customer view). This is
// the per-job 'are we current?' summary.
//
// Pure derivation. No persisted records.

import type { ArPayment } from './ar-payment';
import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

export interface JobWaiverDeliveryRow {
  jobId: string;
  projectName: string;
  paymentCount: number;
  waiverCount: number;
  deliveredCount: number;
  /** deliveredCount / paymentCount. 0 when no payments. */
  deliveryRate: number;
  /** paymentCount - deliveredCount. Negative would mean more
   *  waivers than payments (shouldn't happen). */
  gap: number;
}

export interface JobWaiverDeliveryRollup {
  jobsConsidered: number;
  totalPayments: number;
  totalDelivered: number;
  totalGap: number;
  blendedDeliveryRate: number;
}

export interface JobWaiverDeliveryInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arPayments: ArPayment[];
  lienWaivers: LienWaiver[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobWaiverDeliveryRate(
  inputs: JobWaiverDeliveryInputs,
): {
  rollup: JobWaiverDeliveryRollup;
  rows: JobWaiverDeliveryRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const paymentsByJob = new Map<string, number>();
  for (const p of inputs.arPayments) {
    paymentsByJob.set(p.jobId, (paymentsByJob.get(p.jobId) ?? 0) + 1);
  }
  const waiversByJob = new Map<string, LienWaiver[]>();
  for (const w of inputs.lienWaivers) {
    if (w.status === 'VOIDED') continue;
    const list = waiversByJob.get(w.jobId) ?? [];
    list.push(w);
    waiversByJob.set(w.jobId, list);
  }

  let totalPayments = 0;
  let totalDelivered = 0;
  let totalGap = 0;

  const rows: JobWaiverDeliveryRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const paymentCount = paymentsByJob.get(j.id) ?? 0;
    const waivers = waiversByJob.get(j.id) ?? [];
    const delivered = waivers.filter((w) => !!w.deliveredOn).length;
    const gap = paymentCount - delivered;
    const rate = paymentCount === 0
      ? 0
      : Math.round((delivered / paymentCount) * 10_000) / 10_000;
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      paymentCount,
      waiverCount: waivers.length,
      deliveredCount: delivered,
      deliveryRate: rate,
      gap,
    });
    totalPayments += paymentCount;
    totalDelivered += delivered;
    totalGap += gap;
  }

  // Sort: largest gap first.
  rows.sort((a, b) => {
    if (a.gap !== b.gap) return b.gap - a.gap;
    return b.paymentCount - a.paymentCount;
  });

  const blended = totalPayments === 0
    ? 0
    : Math.round((totalDelivered / totalPayments) * 10_000) / 10_000;

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalPayments,
      totalDelivered,
      totalGap,
      blendedDeliveryRate: blended,
    },
    rows,
  };
}
