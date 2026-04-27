// Bid-day go/no-go composite check.
//
// Plain English: the morning-of-bid sanity check. One function that
// runs every available compliance check on a priced estimate and
// returns a single "ready to submit?" yes/no plus the exact list
// of every blocker.
//
// Composes existing checks:
//   - bid-checklist (bid-readiness items)
//   - sub-list-audit (PCC §4104 completeness on must-list subs)
//   - addendum acknowledgments (no un-ack'd addenda)
//   - bid-security present (the agency requires it)
//
// Pure derivation. No new persisted records.

import { computeBidChecklist, type BidChecklistItem } from './bid-checklist';
import { unacknowledgedAddenda } from './addendum';
import type { PricedEstimate } from './priced-estimate';
import { computeEstimateTotals } from './priced-estimate';
import { buildSubListAudit, type SubListIssue } from './sub-list-audit';

export interface GoNogoBlocker {
  source:
    | 'BID_CHECKLIST'
    | 'SUB_LIST_AUDIT'
    | 'ADDENDA'
    | 'BID_SECURITY'
    | 'PRICING';
  detail: string;
}

export interface GoNogoReport {
  estimateId: string;
  ready: boolean;
  blockers: GoNogoBlocker[];
  warnings: GoNogoBlocker[];
  /** Snapshot of intermediates so the UI can deep-link without
   *  re-running each check. */
  bidChecklistItems: BidChecklistItem[];
  subListIssues: SubListIssue[];
  unackedAddendaCount: number;
  bidTotalCents: number;
  unpricedLineCount: number;
}

export function buildBidGoNogo(estimate: PricedEstimate): GoNogoReport {
  const blockers: GoNogoBlocker[] = [];
  const warnings: GoNogoBlocker[] = [];

  const totals = computeEstimateTotals(estimate);

  // ---- bid-checklist (existing module) -------------------------
  const checklist = computeBidChecklist(estimate, totals);
  for (const item of checklist.items) {
    if (item.severity === 'blocker' && item.status === 'fail') {
      blockers.push({
        source: 'BID_CHECKLIST',
        detail: `${item.label}${item.detail ? ` — ${item.detail}` : ''}`,
      });
    } else if (item.severity === 'recommended' && item.status !== 'pass') {
      warnings.push({
        source: 'BID_CHECKLIST',
        detail: `${item.label}${item.detail ? ` — ${item.detail}` : ''}`,
      });
    }
  }

  // ---- §4104 sub-list completeness ----------------------------
  const subAudit = buildSubListAudit({
    estimate,
    bidTotalCents: totals.bidTotalCents,
  });
  for (const issue of subAudit.issues) {
    if (issue.severity === 'BLOCKER') {
      blockers.push({ source: 'SUB_LIST_AUDIT', detail: issue.detail });
    } else {
      warnings.push({ source: 'SUB_LIST_AUDIT', detail: issue.detail });
    }
  }

  // ---- Addendum acknowledgments -------------------------------
  const unacked = unacknowledgedAddenda(estimate.addenda ?? []);
  if (unacked.length > 0) {
    blockers.push({
      source: 'ADDENDA',
      detail: `${unacked.length} un-acknowledged addend${unacked.length === 1 ? 'um' : 'a'} — ack each before submit.`,
    });
  }

  // ---- Bid security presence ----------------------------------
  if (!estimate.bidSecurity) {
    warnings.push({
      source: 'BID_SECURITY',
      detail: 'No bid security configured. Most CA public works require 10% — confirm before sealing the envelope.',
    });
  }

  // ---- Pricing completeness -----------------------------------
  if (totals.unpricedLineCount > 0) {
    blockers.push({
      source: 'PRICING',
      detail: `${totals.unpricedLineCount} bid line${totals.unpricedLineCount === 1 ? ' has' : 's have'} no unit price.`,
    });
  }

  return {
    estimateId: estimate.id,
    ready: blockers.length === 0,
    blockers,
    warnings,
    bidChecklistItems: checklist.items,
    subListIssues: subAudit.issues,
    unackedAddendaCount: unacked.length,
    bidTotalCents: totals.bidTotalCents,
    unpricedLineCount: totals.unpricedLineCount,
  };
}
