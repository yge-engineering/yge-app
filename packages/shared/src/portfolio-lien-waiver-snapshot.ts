// Portfolio lien-waiver snapshot.
//
// Plain English: as-of today, count waivers, sum payment amounts
// + disputed amounts on signed/delivered, break down by kind +
// status, count distinct jobs + owners, and surface YTD totals.
// Drives the right-now lien-waiver compliance overview against
// CA Civil Code §§8132/8134/8136/8138.
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind, LienWaiverStatus } from './lien-waiver';

export interface PortfolioLienWaiverSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalWaivers: number;
  ytdWaivers: number;
  signedWaivers: number;
  deliveredWaivers: number;
  draftWaivers: number;
  voidedWaivers: number;
  totalPaymentAmountCents: number;
  totalDisputedAmountCents: number;
  byKind: Partial<Record<LienWaiverKind, number>>;
  byStatus: Partial<Record<LienWaiverStatus, number>>;
  distinctJobs: number;
  distinctOwners: number;
}

export interface PortfolioLienWaiverSnapshotInputs {
  lienWaivers: LienWaiver[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioLienWaiverSnapshot(
  inputs: PortfolioLienWaiverSnapshotInputs,
): PortfolioLienWaiverSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byKind = new Map<LienWaiverKind, number>();
  const byStatus = new Map<LienWaiverStatus, number>();
  const jobs = new Set<string>();
  const owners = new Set<string>();

  let totalWaivers = 0;
  let ytdWaivers = 0;
  let signedWaivers = 0;
  let deliveredWaivers = 0;
  let draftWaivers = 0;
  let voidedWaivers = 0;
  let totalPaymentAmountCents = 0;
  let totalDisputedAmountCents = 0;

  for (const w of inputs.lienWaivers) {
    if (w.throughDate > asOf) continue;
    totalWaivers += 1;
    byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
    byStatus.set(w.status, (byStatus.get(w.status) ?? 0) + 1);
    jobs.add(w.jobId);
    if (w.ownerName) owners.add(w.ownerName);
    if (w.status === 'SIGNED') signedWaivers += 1;
    else if (w.status === 'DELIVERED') deliveredWaivers += 1;
    else if (w.status === 'DRAFT') draftWaivers += 1;
    else if (w.status === 'VOIDED') voidedWaivers += 1;
    if (w.status !== 'VOIDED') {
      totalPaymentAmountCents += w.paymentAmountCents ?? 0;
      totalDisputedAmountCents += w.disputedAmountCents ?? 0;
    }
    if (Number(w.throughDate.slice(0, 4)) === logYear) ytdWaivers += 1;
  }

  const kOut: Partial<Record<LienWaiverKind, number>> = {};
  for (const [k, v] of byKind) kOut[k] = v;
  const sOut: Partial<Record<LienWaiverStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalWaivers,
    ytdWaivers,
    signedWaivers,
    deliveredWaivers,
    draftWaivers,
    voidedWaivers,
    totalPaymentAmountCents,
    totalDisputedAmountCents,
    byKind: kOut,
    byStatus: sOut,
    distinctJobs: jobs.size,
    distinctOwners: owners.size,
  };
}
