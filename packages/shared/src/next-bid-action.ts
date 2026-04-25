// Next bid action — given a job + the drafts and estimates tied to it,
// what's the single most useful thing the estimator should do right now?
//
// The pursuit pipeline has obvious phases:
//   1. No drafts yet → run Plans-to-Estimate on the spec
//   2. Draft exists but no priced estimate → convert to a priced estimate
//   3. Priced estimate exists but lines unpriced → fill in unit prices
//   4. Priced + lines done but missing security / addenda acks → fix
//   5. All ready → print the envelope checklist
//
// The job page renders one "Next step" card based on this — keeps the
// estimator from staring at a half-filled-in screen wondering what's
// expected next.

export interface NextBidActionInput {
  /** Drafts tied to this job. Sorted newest-first by the caller. */
  drafts: Array<{ id: string; createdAt: string }>;
  /** Priced estimates tied to this job. Sorted newest-first by the caller. */
  estimates: Array<{
    id: string;
    bidItemCount: number;
    pricedLineCount: number;
    unpricedLineCount: number;
    /** May be undefined on summary entries written before the field shipped. */
    unacknowledgedAddendumCount?: number;
    /** Cents — may be 0 when nothing has been priced yet. */
    bidTotalCents: number;
  }>;
}

export interface NextBidAction {
  /** Stable id for analytics + e2e tests. */
  id:
    | 'run-plans-to-estimate'
    | 'convert-draft'
    | 'price-lines'
    | 'ack-addenda'
    | 'add-security'
    | 'print-envelope'
    | 'no-action';
  /** One-line label rendered as the action button. */
  label: string;
  /** Sub-line below the label. */
  detail: string;
  /** Where to send the user when they click. May be undefined for
   *  "no action" / informational states. */
  href?: string;
  /** Whether this is a celebratory state (everything ready) — UI uses
   *  a green styling instead of the default blue. */
  done?: boolean;
}

export function nextBidAction(
  jobId: string,
  input: NextBidActionInput,
): NextBidAction {
  // Phase 1 — no drafts. Send the user to Plans-to-Estimate with this
  // job pre-selected.
  if (input.drafts.length === 0 && input.estimates.length === 0) {
    return {
      id: 'run-plans-to-estimate',
      label: 'Run Plans-to-Estimate',
      detail: 'Paste the RFP / spec text and let AI extract the bid items.',
      href: `/plans-to-estimate?jobId=${encodeURIComponent(jobId)}`,
    };
  }

  // Phase 2 — drafts but no priced estimate. Pick the newest draft.
  if (input.estimates.length === 0) {
    const newest = input.drafts[0];
    return {
      id: 'convert-draft',
      label: 'Convert draft to priced estimate',
      detail: 'Open the latest draft and start filling in unit prices.',
      href: newest ? `/drafts/${newest.id}` : `/drafts`,
    };
  }

  // From here on we have at least one priced estimate. Operate on the
  // newest one (caller sorts).
  const e = input.estimates[0];
  if (!e) {
    return { id: 'no-action', label: 'No action', detail: '' };
  }

  // Phase 3 — lines still unpriced.
  if (e.unpricedLineCount > 0) {
    return {
      id: 'price-lines',
      label: `Price ${e.unpricedLineCount} line${e.unpricedLineCount === 1 ? '' : 's'}`,
      detail: `${e.pricedLineCount} of ${e.bidItemCount} items already priced.`,
      href: `/estimates/${e.id}`,
    };
  }

  // Phase 4a — addenda logged but not acknowledged.
  if ((e.unacknowledgedAddendumCount ?? 0) > 0) {
    const n = e.unacknowledgedAddendumCount!;
    return {
      id: 'ack-addenda',
      label: `Acknowledge ${n} addend${n === 1 ? 'um' : 'a'}`,
      detail: 'Un-acknowledged addenda make the bid non-responsive at open.',
      href: `/estimates/${e.id}`,
    };
  }

  // Phase 5 — everything looks good. Send to the envelope checklist so
  // the estimator can do the final physical check before sealing.
  return {
    id: 'print-envelope',
    label: 'Print the bid envelope checklist',
    detail: 'All lines priced, all addenda acknowledged. Final stuff-and-seal step.',
    href: `/estimates/${e.id}/envelope`,
    done: true,
  };
}
