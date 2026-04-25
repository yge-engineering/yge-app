// Bid envelope checklist — the last-mile manifest of every physical item
// that has to be in the paper bid envelope on bid day.
//
// This is the COMPLEMENT to bid-checklist.ts. The bid readiness checklist
// answers "is the estimate complete enough to submit?" and runs in the
// editor as a green/yellow/red banner. The bid envelope checklist answers
// "do I have every piece of paper in the envelope on my desk?" and prints
// with checkboxes so the estimator ticks each item as they stuff it.
//
// Both pull from the same source of truth (the priced estimate + its
// computed totals + the company info + the addendum / sub list / bid
// security state). Drift between them is impossible — they share types.

import type { CompanyInfo } from './company';
import { YGE_COMPANY_INFO } from './company';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';
import { sortedAddenda, unacknowledgedAddenda } from './addendum';
import { formatUSD } from './money';

export type EnvelopeItemSeverity = 'required' | 'recommended';

export interface EnvelopeItem {
  /** Stable id so the checkbox can be tracked if the printer ever becomes
   *  interactive (e.g. signed-off envelope log in Phase 2). */
  id: string;
  /** Short label that prints on the line. */
  label: string;
  /** Optional one-line detail (right of the label, lighter weight). */
  detail?: string;
  /** Required = bid is non-responsive without it. Recommended = best
   *  practice but won't get the bid tossed. */
  severity: EnvelopeItemSeverity;
  /** When true, the printer renders the row in red as an extra warning —
   *  used for un-acknowledged addenda. */
  warn?: boolean;
}

export interface BidEnvelopeChecklist {
  items: EnvelopeItem[];
  /** True iff every required item is accounted for. The renderer surfaces
   *  this as a green/red banner across the top of the printable. */
  allRequiredAccountedFor: boolean;
}

/** Build the envelope checklist from an estimate + totals. */
export function buildEnvelopeChecklist(
  estimate: PricedEstimate,
  totals: PricedEstimateTotals,
  company: CompanyInfo = YGE_COMPANY_INFO,
): BidEnvelopeChecklist {
  const items: EnvelopeItem[] = [];

  // 1. Sealed bid form — always required.
  items.push({
    id: 'sealed-bid-form',
    label: 'Sealed bid form, signed by an officer',
    detail: `Bid total ${formatUSD(totals.bidTotalCents)}`,
    severity: 'required',
  });

  // 2. Cover letter / transmittal — recommended (not strictly required, but
  //    we always include one).
  items.push({
    id: 'cover-letter',
    label: 'Cover letter / transmittal',
    detail: 'Print from the Cover letter page',
    severity: 'recommended',
  });

  // 3. Sub list (PCC §4104). Required iff there are subs to list.
  if (estimate.subBids.length > 0) {
    items.push({
      id: 'sub-list',
      label: 'Designated subcontractor list (PCC \u00a74104)',
      detail: `${estimate.subBids.length} sub${estimate.subBids.length === 1 ? '' : 's'} \u2014 every required sub on the bid form`,
      severity: 'required',
    });
  }

  // 4. Bid security. Required for almost every CA public works bid.
  if (estimate.bidSecurity) {
    const sec = estimate.bidSecurity;
    const typeLabel =
      sec.type === 'BID_BOND'
        ? 'Bid bond'
        : sec.type === 'CASHIERS_CHECK'
          ? "Cashier's check"
          : sec.type === 'CERTIFIED_CHECK'
            ? 'Certified check'
            : 'Bid security';
    const amountCents = Math.round(totals.bidTotalCents * sec.percent);
    const detailParts: string[] = [
      `${typeLabel} \u2014 ${formatUSD(amountCents)}`,
    ];
    if (sec.type === 'BID_BOND' && sec.suretyName) {
      detailParts.push(sec.suretyName);
    }
    if (sec.bondNumber) detailParts.push(`bond #${sec.bondNumber}`);
    items.push({
      id: 'bid-security',
      label: 'Bid security in the envelope',
      detail: detailParts.join(' \u00b7 '),
      severity: 'required',
    });
  } else {
    // No security configured. Most CA public works require it, so flag.
    items.push({
      id: 'bid-security-missing',
      label: 'Bid security in the envelope',
      detail: 'Not configured \u2014 add on the editor before printing',
      severity: 'required',
      warn: true,
    });
  }

  // 5. Addenda. Each addendum must be acknowledged on the bid form. Print
  //    one row per addendum so the estimator confirms each one shows up.
  const addenda = sortedAddenda(estimate.addenda);
  if (addenda.length > 0) {
    const unacked = unacknowledgedAddenda(addenda);
    items.push({
      id: 'addenda-bundle',
      label: `Addenda acknowledged on bid form`,
      detail:
        unacked.length > 0
          ? `${addenda.length} addend${addenda.length === 1 ? 'um' : 'a'} \u2014 ${unacked.length} STILL UN-ACKED`
          : `${addenda.length} addend${addenda.length === 1 ? 'um' : 'a'} \u2014 all acknowledged`,
      severity: 'required',
      warn: unacked.length > 0,
    });
  }

  // 6. License + DIR proofs. Required for CA public works.
  items.push({
    id: 'cslb-cert',
    label: 'Contractor\u2019s license proof',
    detail: `CSLB #${company.cslbLicense}`,
    severity: 'required',
  });
  items.push({
    id: 'dir-cert',
    label: 'DIR public-works registration proof',
    detail: `DIR #${company.dirNumber}`,
    severity: 'required',
  });

  // 7. Recommended best-practices.
  items.push({
    id: 'envelope-marked',
    label: 'Outer envelope marked with project name + bid date',
    detail: estimate.bidDueDate ? `Due: ${estimate.bidDueDate}` : undefined,
    severity: 'recommended',
  });
  items.push({
    id: 'duplicate-copy',
    label: 'Estimator-retained duplicate copy of the bid',
    detail: 'For YGE records and post-bid debrief',
    severity: 'recommended',
  });

  const allRequiredAccountedFor = !items.some(
    (it) => it.severity === 'required' && it.warn === true,
  );

  return { items, allRequiredAccountedFor };
}
