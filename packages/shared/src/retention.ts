// Retention tracker — derives a job-level "money still on the table"
// view from existing AR invoices + AR payments + (optionally) the
// completion-notice date that starts the CA Public Contract Code
// §7107 60-day clock.
//
// This is a pure derivation module — it does NOT introduce a new
// persisted record. It rolls up data already in the system into the
// retention dashboard.

import {
  ca7107RetentionInterest,
  type ArInvoice,
  type ArPayment,
} from './index';

export interface JobRetentionStatus {
  jobId: string;
  customerName: string;
  /** Sum of `retentionCents` across all AR invoices for this job. */
  totalRetentionHeldCents: number;
  /** Sum of RETENTION_RELEASE payments applied to this job. */
  totalRetentionReleasedCents: number;
  /** Difference — what's still being held. */
  outstandingRetentionCents: number;
  /** Date of the most recent AR invoice in the run (best proxy for
   *  "completion" in absence of an explicit completion notice). */
  lastInvoiceDate: string | null;
  /** Optional completion-notice date if the caller has it. */
  completionNoticeDate: string | null;
  /** §7107 prompt-pay interest projection if completion-notice date
   *  is known. Null otherwise. */
  ca7107: {
    dueOn: string;
    daysLate: number;
    interestCents: number;
  } | null;
}

/**
 * Build the retention status for a single job.
 *
 * @param jobId The job to roll up.
 * @param customerName Display name for the dashboard row.
 * @param invoices  All AR invoices for this job.
 * @param payments  All AR payments for this job.
 * @param completionNoticeDate Optional yyyy-mm-dd. If supplied, drives
 *                             the §7107 60-day interest calc.
 */
export function buildJobRetentionStatus(args: {
  jobId: string;
  customerName: string;
  invoices: ArInvoice[];
  payments: ArPayment[];
  completionNoticeDate?: string;
  now?: Date;
}): JobRetentionStatus {
  const { jobId, customerName, invoices, payments, completionNoticeDate } = args;
  const now = args.now ?? new Date();

  let totalRetentionHeldCents = 0;
  let lastInvoiceDate: string | null = null;
  for (const inv of invoices) {
    totalRetentionHeldCents += inv.retentionCents ?? 0;
    if (!lastInvoiceDate || inv.invoiceDate > lastInvoiceDate) {
      lastInvoiceDate = inv.invoiceDate;
    }
  }

  let totalRetentionReleasedCents = 0;
  for (const p of payments) {
    if (p.kind === 'RETENTION_RELEASE') {
      totalRetentionReleasedCents += p.amountCents;
    }
  }

  const outstandingRetentionCents = Math.max(
    0,
    totalRetentionHeldCents - totalRetentionReleasedCents,
  );

  let ca7107: JobRetentionStatus['ca7107'] = null;
  if (completionNoticeDate && outstandingRetentionCents > 0) {
    ca7107 = ca7107RetentionInterest({
      completedOn: completionNoticeDate,
      retentionHeldCents: outstandingRetentionCents,
      now,
    });
  }

  return {
    jobId,
    customerName,
    totalRetentionHeldCents,
    totalRetentionReleasedCents,
    outstandingRetentionCents,
    lastInvoiceDate,
    completionNoticeDate: completionNoticeDate ?? null,
    ca7107,
  };
}

export interface RetentionRollup {
  /** Number of jobs with any retention activity. */
  jobsWithRetention: number;
  totalHeldCents: number;
  totalReleasedCents: number;
  totalOutstandingCents: number;
  /** Outstanding retention on jobs whose §7107 clock has expired. */
  pastDueOutstandingCents: number;
  /** Total statutory interest already accrued on past-due retention. */
  totalAccruedInterestCents: number;
  pastDueJobCount: number;
}

export function computeRetentionRollup(
  rows: JobRetentionStatus[],
): RetentionRollup {
  let totalHeldCents = 0;
  let totalReleasedCents = 0;
  let totalOutstandingCents = 0;
  let pastDueOutstandingCents = 0;
  let totalAccruedInterestCents = 0;
  let pastDueJobCount = 0;
  let jobsWithRetention = 0;
  for (const r of rows) {
    if (
      r.totalRetentionHeldCents > 0 ||
      r.totalRetentionReleasedCents > 0
    ) {
      jobsWithRetention += 1;
    }
    totalHeldCents += r.totalRetentionHeldCents;
    totalReleasedCents += r.totalRetentionReleasedCents;
    totalOutstandingCents += r.outstandingRetentionCents;
    if (r.ca7107 && r.ca7107.daysLate > 0) {
      pastDueJobCount += 1;
      pastDueOutstandingCents += r.outstandingRetentionCents;
      totalAccruedInterestCents += r.ca7107.interestCents;
    }
  }
  return {
    jobsWithRetention,
    totalHeldCents,
    totalReleasedCents,
    totalOutstandingCents,
    pastDueOutstandingCents,
    totalAccruedInterestCents,
    pastDueJobCount,
  };
}
