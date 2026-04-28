// Submittal turnaround by spec section.
//
// Plain English: every submittal carries a spec section reference
// (CSI MasterFormat — '03 30 00 - Cast-in-Place Concrete'). Some
// sections clear in 5 working days, some grind through three
// REVISE_RESUBMIT loops. Knowing which spec sections are slow
// across our portfolio lets us schedule fab orders earlier on
// the next pursuit (or ask the engineer for early-release
// approval at preconstruction).
//
// Per row: specSection (free-form, normalized whitespace),
// submitted, approved (APPROVED + APPROVED_AS_NOTED),
// reviseResubmit, rejected, blockedOrderingCount, distinctJobs,
// avgTurnaroundDays (over rows with both submittedAt + returnedAt),
// pendingCount.
//
// Sort by avgTurnaroundDays desc, ties by submitted desc.
//
// Different from submittal-turnaround (per-submittal),
// submittal-by-author (per-author productivity), and
// job-submittal-kind-mix (per-job kind breakdown).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalBySpecSectionRow {
  specSection: string;
  submitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
  avgTurnaroundDays: number;
  pendingCount: number;
}

export interface SubmittalBySpecSectionRollup {
  sectionsConsidered: number;
  totalSubmitted: number;
  unattributed: number;
}

export interface SubmittalBySpecSectionInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm-dd window applied to submittedAt (or createdAt slice). */
  fromDate?: string;
  toDate?: string;
}

export function buildSubmittalBySpecSection(
  inputs: SubmittalBySpecSectionInputs,
): {
  rollup: SubmittalBySpecSectionRollup;
  rows: SubmittalBySpecSectionRow[];
} {
  type Acc = {
    display: string;
    submitted: number;
    approved: number;
    revise: number;
    rejected: number;
    blocked: number;
    pending: number;
    jobs: Set<string>;
    turnaroundSum: number;
    turnaroundCount: number;
  };
  const accs = new Map<string, Acc>();
  let total = 0;
  let unattributed = 0;

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    if (inputs.fromDate && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref > inputs.toDate) continue;
    total += 1;
    const display = (s.specSection ?? '').replace(/\s+/g, ' ').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = display.toLowerCase();
    const acc = accs.get(key) ?? {
      display,
      submitted: 0,
      approved: 0,
      revise: 0,
      rejected: 0,
      blocked: 0,
      pending: 0,
      jobs: new Set<string>(),
      turnaroundSum: 0,
      turnaroundCount: 0,
    };
    acc.submitted += 1;
    acc.jobs.add(s.jobId);
    if (s.blocksOrdering) acc.blocked += 1;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') acc.approved += 1;
    else if (s.status === 'REVISE_RESUBMIT') acc.revise += 1;
    else if (s.status === 'REJECTED') acc.rejected += 1;
    else if (s.status === 'SUBMITTED') acc.pending += 1;
    if (s.submittedAt && s.returnedAt) {
      acc.turnaroundSum += daysBetween(s.submittedAt, s.returnedAt);
      acc.turnaroundCount += 1;
    }
    accs.set(key, acc);
  }

  const rows: SubmittalBySpecSectionRow[] = [];
  for (const acc of accs.values()) {
    const avg = acc.turnaroundCount === 0
      ? 0
      : Math.round((acc.turnaroundSum / acc.turnaroundCount) * 100) / 100;
    rows.push({
      specSection: acc.display,
      submitted: acc.submitted,
      approvedCount: acc.approved,
      reviseResubmitCount: acc.revise,
      rejectedCount: acc.rejected,
      blockedOrderingCount: acc.blocked,
      distinctJobs: acc.jobs.size,
      avgTurnaroundDays: avg,
      pendingCount: acc.pending,
    });
  }

  rows.sort((a, b) => {
    if (b.avgTurnaroundDays !== a.avgTurnaroundDays) {
      return b.avgTurnaroundDays - a.avgTurnaroundDays;
    }
    return b.submitted - a.submitted;
  });

  return {
    rollup: {
      sectionsConsidered: rows.length,
      totalSubmitted: total,
      unattributed,
    },
    rows,
  };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
