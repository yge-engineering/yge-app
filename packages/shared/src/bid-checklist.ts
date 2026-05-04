// Bid readiness checklist.
//
// Single function that walks a priced estimate and answers: "if I dropped
// this in the bid box right now, what's likely to get it tossed?". The
// editor renders the result as a green/red banner so the estimator can
// clear every blocker before sealing the envelope.
//
// Status semantics:
//   pass — done. Green check.
//   warn — soft issue. Yellow. The bid will still be accepted but the
//          item is missing context the reviewer probably wants.
//   fail — hard issue. Red. The bid is non-responsive in this state and
//          will be rejected at bid open.
//
// Severity is the "should I block submission?" question. `blocker`
// fails make the bid non-responsive — that's the loud red banner. The
// `recommended` items are fixable later but the estimator should know
// they're missing.

import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';
import { unacknowledgedAddenda } from './addendum';
import { classifySubBids, isHighwayClassProjectType } from './sub-bid';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export type BidChecklistStatus = 'pass' | 'warn' | 'fail';
export type BidChecklistSeverity = 'blocker' | 'recommended';

export interface BidChecklistItem {
  /** Stable key for the row — drives React `key` and analytics later. */
  id: string;
  /** One-line label shown in the UI. */
  label: string;
  status: BidChecklistStatus;
  severity: BidChecklistSeverity;
  /** Sub-line shown under the label when status !== pass. */
  detail?: string;
}

export interface BidChecklist {
  items: BidChecklistItem[];
  /** True iff every blocker is `pass`. The submit button can light up
   *  green when this is true even if `recommended` items are still warn. */
  readyToSubmit: boolean;
  /** True iff every item is `pass`. The "everything clean" banner. */
  allClear: boolean;
  /** Counts for the banner header. */
  blockerFailCount: number;
  recommendedWarnCount: number;
}

export function computeBidChecklist(
  estimate: PricedEstimate,
  totals: PricedEstimateTotals,
  locale: Locale = 'en',
): BidChecklist {
  const items: BidChecklistItem[] = [];
  const tr = (key: string, vars?: Record<string, string | number>): string =>
    translate(SEED_DICTIONARY, locale, key, vars);

  // ---- Blocker items -----------------------------------------------------

  // All bid items priced. An estimate with un-priced lines isn't really
  // ready to submit — we treat unpriced as a blocker because submitting
  // a bid with $0 lines distorts the bid total in a way the agency will
  // notice.
  if (totals.unpricedLineCount === 0) {
    items.push({
      id: 'lines-priced',
      label: tr('bidChecklist.linesPriced.label'),
      status: 'pass',
      severity: 'blocker',
    });
  } else {
    items.push({
      id: 'lines-priced',
      label: tr('bidChecklist.linesPriced.label'),
      status: 'fail',
      severity: 'blocker',
      detail:
        totals.unpricedLineCount === 1
          ? tr('bidChecklist.linesPriced.detailOne')
          : tr('bidChecklist.linesPriced.detailMany', {
              count: totals.unpricedLineCount,
            }),
    });
  }

  // Bid total > 0. Catches the obvious "user opened the editor but never
  // filled anything in" case so the checklist isn't all-green at $0.
  if (totals.bidTotalCents > 0) {
    items.push({
      id: 'bid-total-positive',
      label: tr('bidChecklist.bidTotalPositive.label'),
      status: 'pass',
      severity: 'blocker',
    });
  } else {
    items.push({
      id: 'bid-total-positive',
      label: tr('bidChecklist.bidTotalPositive.label'),
      status: 'fail',
      severity: 'blocker',
      detail: tr('bidChecklist.bidTotalPositive.detail'),
    });
  }

  // Addenda all acknowledged. The single most common reason a CA bid
  // gets tossed at bid open.
  const unacked = unacknowledgedAddenda(estimate.addenda ?? []);
  if (unacked.length === 0) {
    items.push({
      id: 'addenda-acknowledged',
      label: tr('bidChecklist.addenda.label'),
      status: 'pass',
      severity: 'blocker',
    });
  } else {
    items.push({
      id: 'addenda-acknowledged',
      label: tr('bidChecklist.addenda.label'),
      status: 'fail',
      severity: 'blocker',
      detail:
        unacked.length === 1
          ? tr('bidChecklist.addenda.detailOne')
          : tr('bidChecklist.addenda.detailMany', { count: unacked.length }),
    });
  }

  // ---- Recommended items -------------------------------------------------

  // Bid security. Almost always required on CA public works (10% bond,
  // cashier's check, or certified check). Recommended-not-blocker
  // because some private/task-order work skips it.
  if (estimate.bidSecurity) {
    items.push({
      id: 'bid-security',
      label: tr('bidChecklist.bidSecurity.label'),
      status: 'pass',
      severity: 'recommended',
    });
  } else {
    items.push({
      id: 'bid-security',
      label: tr('bidChecklist.bidSecurity.label'),
      status: 'warn',
      severity: 'recommended',
      detail: tr('bidChecklist.bidSecurity.detail'),
    });
  }

  // §4104 sub list — any subs that landed in must-list count as listed
  // because the print page renders every sub in the list. The check is
  // really "does this estimate have *any* subs captured?" — which is a
  // soft signal that sub bidding has happened. Skipping silently when
  // the estimate is too small for the threshold to bite.
  const sub = classifySubBids(
    estimate.subBids ?? [],
    totals.bidTotalCents,
    estimate.projectType,
  );
  const captured = (estimate.subBids ?? []).length;
  if (captured > 0) {
    items.push({
      id: 'sub-list',
      label: tr('bidChecklist.subList.label'),
      status: 'pass',
      severity: 'recommended',
      detail:
        sub.mustList.length > 0
          ? captured === 1
            ? tr('bidChecklist.subList.detailListedOne', {
                listed: sub.mustList.length,
              })
            : tr('bidChecklist.subList.detailListedMany', {
                listed: sub.mustList.length,
                captured,
              })
          : undefined,
    });
  } else {
    // No subs captured. The §4104 listing rule only triggers when a sub
    // *exists*, so absence of subs is never automatically non-responsive.
    // But on highway / streets / bridges work where the §10K floor is
    // material, a million-dollar bid with zero subs is a process smell
    // (virtually every large highway job has paving, striping, traffic
    // control, etc.). Warn only in that combined case; pass otherwise.
    const isHighwayLike = isHighwayClassProjectType(estimate.projectType);
    if (isHighwayLike && totals.bidTotalCents >= sub.thresholdCents) {
      items.push({
        id: 'sub-list',
        label: tr('bidChecklist.subList.label'),
        status: 'warn',
        severity: 'recommended',
        detail: tr('bidChecklist.subList.detailHighway'),
      });
    } else {
      items.push({
        id: 'sub-list',
        label: tr('bidChecklist.subList.label'),
        status: 'pass',
        severity: 'recommended',
        detail: tr('bidChecklist.subList.detailNoSubs'),
      });
    }
  }

  // Owner / agency name on file. Bid forms always have a "to whom it
  // may concern" addressee — cover letters, transmittals, and the
  // print summary all want this filled.
  if (estimate.ownerAgency && estimate.ownerAgency.trim().length > 0) {
    items.push({
      id: 'owner-agency',
      label: tr('bidChecklist.ownerAgency.label'),
      status: 'pass',
      severity: 'recommended',
    });
  } else {
    items.push({
      id: 'owner-agency',
      label: tr('bidChecklist.ownerAgency.label'),
      status: 'warn',
      severity: 'recommended',
      detail: tr('bidChecklist.ownerAgency.detail'),
    });
  }

  // Bid due date. Soft check — useful for sorting and reminders but
  // not strictly required to assemble the package.
  if (estimate.bidDueDate && estimate.bidDueDate.trim().length > 0) {
    items.push({
      id: 'bid-due-date',
      label: tr('bidChecklist.bidDueDate.label'),
      status: 'pass',
      severity: 'recommended',
    });
  } else {
    items.push({
      id: 'bid-due-date',
      label: tr('bidChecklist.bidDueDate.label'),
      status: 'warn',
      severity: 'recommended',
      detail: tr('bidChecklist.bidDueDate.detail'),
    });
  }

  // ---- Roll-ups ---------------------------------------------------------

  const blockerFailCount = items.filter(
    (i) => i.severity === 'blocker' && i.status === 'fail',
  ).length;
  const recommendedWarnCount = items.filter(
    (i) => i.severity === 'recommended' && i.status === 'warn',
  ).length;
  const readyToSubmit = blockerFailCount === 0;
  const allClear = items.every((i) => i.status === 'pass');

  return {
    items,
    readyToSubmit,
    allClear,
    blockerFailCount,
    recommendedWarnCount,
  };
}
