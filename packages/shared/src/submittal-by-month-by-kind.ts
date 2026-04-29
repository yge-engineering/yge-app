// Per (month, SubmittalKind) submittal volume.
//
// Plain English: bucket non-draft submittals by (yyyy-mm,
// SubmittalKind) — SHOP_DRAWING / PRODUCT_DATA / SAMPLE / etc.
// Useful for "we always have a SHOP_DRAWING crunch in Q1"
// pattern detection.
//
// Per row: month, kind, count, approvedCount, distinctJobs.
//
// Sort: month asc, kind asc.
//
// Different from job-submittal-kind-mix (per-job, no month
// axis), submittal-monthly-volume (per-month, no kind axis).
//
// Pure derivation. No persisted records.

import type { Submittal, SubmittalKind } from './submittal';

export interface SubmittalByMonthByKindRow {
  month: string;
  kind: SubmittalKind;
  count: number;
  approvedCount: number;
  distinctJobs: number;
}

export interface SubmittalByMonthByKindRollup {
  monthsConsidered: number;
  kindsConsidered: number;
  totalSubmittals: number;
}

export interface SubmittalByMonthByKindInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildSubmittalByMonthByKind(
  inputs: SubmittalByMonthByKindInputs,
): {
  rollup: SubmittalByMonthByKindRollup;
  rows: SubmittalByMonthByKindRow[];
} {
  type Acc = {
    month: string;
    kind: SubmittalKind;
    count: number;
    approved: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  const kindSet = new Set<SubmittalKind>();
  let totalSubmittals = 0;

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${month}|${s.kind}`;
    const acc = accs.get(key) ?? {
      month,
      kind: s.kind,
      count: 0,
      approved: 0,
      jobs: new Set<string>(),
    };
    acc.count += 1;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') acc.approved += 1;
    acc.jobs.add(s.jobId);
    accs.set(key, acc);
    monthSet.add(month);
    kindSet.add(s.kind);
    totalSubmittals += 1;
  }

  const rows: SubmittalByMonthByKindRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      kind: acc.kind,
      count: acc.count,
      approvedCount: acc.approved,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.kind.localeCompare(b.kind);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      kindsConsidered: kindSet.size,
      totalSubmittals,
    },
    rows,
  };
}
