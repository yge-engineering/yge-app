// Per-job retention release readiness.
//
// Plain English: substantial-completion-readiness asks "can we
// call walkthrough?" This module asks the next-step question:
// "is this job ready for retention release?" Per §7107, the
// agency must release retention 60 days from substantial-
// completion notice — but YGE has to deliver the release
// packet first.
//
// Blockers checked:
//   - open SAFETY or MAJOR punch items
//   - any RFI or submittal still open
//   - unsigned/undelivered lien waivers on every payment received
//   - retention still being held (we shouldn't be requesting
//     release if there's no retention to release)
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

export type RetentionReleaseFlag =
  | 'READY'           // 0 blockers + retention held > 0
  | 'CLOSE'           // 1-3 blockers
  | 'NOT_READY'       // 4+ blockers
  | 'NO_RETENTION';   // nothing held — irrelevant

export interface RetentionReleaseRow {
  jobId: string;
  projectName: string;
  retentionHeldCents: number;
  openSafetyPunch: number;
  openMajorPunch: number;
  openRfis: number;
  pendingSubmittals: number;
  paymentsMissingWaiver: number;
  blockerCount: number;
  flag: RetentionReleaseFlag;
}

export interface RetentionReleaseRollup {
  jobsConsidered: number;
  ready: number;
  close: number;
  notReady: number;
  noRetention: number;
  totalReadyRetentionCents: number;
}

export interface RetentionReleaseInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  lienWaivers: LienWaiver[];
  punchItems: PunchItem[];
  rfis: Rfi[];
  submittals: Submittal[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobRetentionReleaseReadiness(
  inputs: RetentionReleaseInputs,
): {
  rollup: RetentionReleaseRollup;
  rows: RetentionReleaseRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Retention held per job (sum invoices.retentionCents -
  // sum payments.RETENTION_RELEASE).
  const retentionHeld = new Map<string, number>();
  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    retentionHeld.set(
      inv.jobId,
      (retentionHeld.get(inv.jobId) ?? 0) + (inv.retentionCents ?? 0),
    );
  }
  for (const p of inputs.arPayments) {
    if (p.kind === 'RETENTION_RELEASE') {
      retentionHeld.set(
        p.jobId,
        (retentionHeld.get(p.jobId) ?? 0) - p.amountCents,
      );
    }
  }

  // Punch items per job.
  const safetyOpenByJob = new Map<string, number>();
  const majorOpenByJob = new Map<string, number>();
  for (const p of inputs.punchItems) {
    if (p.status === 'CLOSED' || p.status === 'WAIVED') continue;
    if (p.severity === 'SAFETY') {
      safetyOpenByJob.set(p.jobId, (safetyOpenByJob.get(p.jobId) ?? 0) + 1);
    } else if (p.severity === 'MAJOR') {
      majorOpenByJob.set(p.jobId, (majorOpenByJob.get(p.jobId) ?? 0) + 1);
    }
  }

  // Open RFIs per job (SENT only).
  const openRfisByJob = new Map<string, number>();
  for (const r of inputs.rfis) {
    if (r.status !== 'SENT') continue;
    openRfisByJob.set(r.jobId, (openRfisByJob.get(r.jobId) ?? 0) + 1);
  }

  // Pending submittals per job.
  const pendingSubByJob = new Map<string, number>();
  for (const s of inputs.submittals) {
    if (
      s.status === 'APPROVED' ||
      s.status === 'APPROVED_AS_NOTED' ||
      s.status === 'WITHDRAWN' ||
      s.status === 'REJECTED'
    ) continue;
    pendingSubByJob.set(s.jobId, (pendingSubByJob.get(s.jobId) ?? 0) + 1);
  }

  // Payments missing waiver per job.
  // For each AR payment, check if a SIGNED + DELIVERED LienWaiver
  // exists with the matching arPaymentId.
  const waiversByPayment = new Map<string, LienWaiver>();
  for (const w of inputs.lienWaivers) {
    if (!w.arPaymentId) continue;
    waiversByPayment.set(w.arPaymentId, w);
  }
  const missingWaiverByJob = new Map<string, number>();
  for (const p of inputs.arPayments) {
    const w = waiversByPayment.get(p.id);
    const ok = w && (w.status === 'SIGNED' || w.status === 'DELIVERED');
    if (!ok) {
      missingWaiverByJob.set(
        p.jobId,
        (missingWaiverByJob.get(p.jobId) ?? 0) + 1,
      );
    }
  }

  const rows: RetentionReleaseRow[] = [];
  const counts = { ready: 0, close: 0, notReady: 0, noRetention: 0 };
  let totalReadyCents = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const heldRaw = retentionHeld.get(j.id) ?? 0;
    const held = Math.max(0, heldRaw);
    const safety = safetyOpenByJob.get(j.id) ?? 0;
    const major = majorOpenByJob.get(j.id) ?? 0;
    const rfis = openRfisByJob.get(j.id) ?? 0;
    const subs = pendingSubByJob.get(j.id) ?? 0;
    const missingWaiver = missingWaiverByJob.get(j.id) ?? 0;
    const blockers = safety + major + rfis + subs + missingWaiver;

    let flag: RetentionReleaseFlag;
    if (held === 0) flag = 'NO_RETENTION';
    else if (blockers === 0) flag = 'READY';
    else if (blockers <= 3) flag = 'CLOSE';
    else flag = 'NOT_READY';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      retentionHeldCents: held,
      openSafetyPunch: safety,
      openMajorPunch: major,
      openRfis: rfis,
      pendingSubmittals: subs,
      paymentsMissingWaiver: missingWaiver,
      blockerCount: blockers,
      flag,
    });
    if (flag === 'READY') {
      counts.ready += 1;
      totalReadyCents += held;
    } else if (flag === 'CLOSE') counts.close += 1;
    else if (flag === 'NOT_READY') counts.notReady += 1;
    else counts.noRetention += 1;
  }

  // READY first (good news + actionable — request the release),
  // then CLOSE (chase remaining blockers), NOT_READY, NO_RETENTION
  // pinned at bottom.
  const tierRank: Record<RetentionReleaseFlag, number> = {
    READY: 0,
    CLOSE: 1,
    NOT_READY: 2,
    NO_RETENTION: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return b.retentionHeldCents - a.retentionHeldCents;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      ready: counts.ready,
      close: counts.close,
      notReady: counts.notReady,
      noRetention: counts.noRetention,
      totalReadyRetentionCents: totalReadyCents,
    },
    rows,
  };
}
