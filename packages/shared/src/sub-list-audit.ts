// PCC §4104 sub-list completeness audit.
//
// Plain English: §4104 requires every sub doing work over a dollar
// threshold to be listed on the bid form with their:
//   - Legal/DBA name
//   - Address
//   - CSLB license number
//   - DIR public-works contractor registration
//   - Portion of work
//   - Dollar amount
//
// Forget any of those on a must-list sub and the bid is non-
// responsive. The agency throws it out at bid open.
//
// This module audits a single priced estimate's sub list and
// surfaces which fields are missing on which subs, splitting
// blockers (must-list subs missing required fields) from warnings
// (borderline subs the estimator should double-check).
//
// Pure derivation. No persisted records.

import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';
import { classifySubBids } from './sub-bid';

export type SubListIssueSeverity = 'BLOCKER' | 'WARNING';

export type SubListMissingField =
  | 'address'
  | 'cslbLicense'
  | 'dirRegistration'
  | 'portionOfWork';

export interface SubListIssue {
  subId: string;
  contractorName: string;
  bidAmountCents: number;
  /** MUST_LIST means the §4104 threshold is exceeded; BORDERLINE
   *  means within $1,000 of the threshold. */
  classification: 'MUST_LIST' | 'BORDERLINE' | 'OPTIONAL';
  severity: SubListIssueSeverity;
  missing: SubListMissingField[];
  /** Human-readable bullet for printing. */
  detail: string;
}

export interface SubListAudit {
  estimateId: string;
  /** Echo the §4104 threshold for the bid total. */
  thresholdCents: number;
  /** Total of every sub's bidAmount across the estimate. */
  totalSubCents: number;
  /** Issues sorted blocker-first, then by sub bid amount desc. */
  issues: SubListIssue[];
  blockerCount: number;
  warningCount: number;
  /** True iff blockerCount === 0 — safe to bid. */
  responsive: boolean;
}

export interface SubListAuditInputs {
  estimate: Pick<PricedEstimate, 'id' | 'subBids' | 'projectType' | 'bidItems' | 'oppPercent'>;
  /** Bid total in cents. Caller computes from priced bid items + O&P;
   *  defaults to sum of subs if not given (rough approximation). */
  bidTotalCents?: number;
}

export function buildSubListAudit(inputs: SubListAuditInputs): SubListAudit {
  const { estimate } = inputs;
  const subs = estimate.subBids ?? [];

  // Best-effort bid total: caller-provided OR sum of subs.
  const bidTotalCents =
    inputs.bidTotalCents ??
    subs.reduce((s, x) => s + x.bidAmountCents, 0);

  const cls = classifySubBids(subs, bidTotalCents, estimate.projectType);

  const issues: SubListIssue[] = [];

  function audit(sub: SubBid, classification: SubListIssue['classification']): void {
    const missing: SubListMissingField[] = [];
    if (!sub.address || sub.address.trim().length === 0) missing.push('address');
    if (!sub.cslbLicense || sub.cslbLicense.trim().length === 0) missing.push('cslbLicense');
    if (!sub.dirRegistration || sub.dirRegistration.trim().length === 0) missing.push('dirRegistration');
    if (!sub.portionOfWork || sub.portionOfWork.trim().length === 0) missing.push('portionOfWork');
    if (missing.length === 0) return;

    const severity: SubListIssueSeverity =
      classification === 'MUST_LIST' ? 'BLOCKER' : 'WARNING';

    issues.push({
      subId: sub.id,
      contractorName: sub.contractorName,
      bidAmountCents: sub.bidAmountCents,
      classification,
      severity,
      missing,
      detail: detailFor(sub.contractorName, classification, missing),
    });
  }

  for (const s of cls.mustList) audit(s, 'MUST_LIST');
  for (const s of cls.borderline) audit(s, 'BORDERLINE');
  // Optional subs are NOT required to be on the form, so we don't
  // bother auditing their fields — leaving them in is a nicety, not
  // a requirement.

  // Sort: BLOCKER first, then by bid amount desc.
  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'BLOCKER' ? -1 : 1;
    return b.bidAmountCents - a.bidAmountCents;
  });

  let blockerCount = 0;
  let warningCount = 0;
  for (const i of issues) {
    if (i.severity === 'BLOCKER') blockerCount += 1;
    else warningCount += 1;
  }

  return {
    estimateId: estimate.id,
    thresholdCents: cls.thresholdCents,
    totalSubCents: cls.totalSubCents,
    issues,
    blockerCount,
    warningCount,
    responsive: blockerCount === 0,
  };
}

function detailFor(
  name: string,
  classification: SubListIssue['classification'],
  missing: SubListMissingField[],
): string {
  const fieldLabels: Record<SubListMissingField, string> = {
    address: 'address',
    cslbLicense: 'CSLB license #',
    dirRegistration: 'DIR registration #',
    portionOfWork: 'portion of work',
  };
  const list = missing.map((f) => fieldLabels[f]).join(', ');
  if (classification === 'MUST_LIST') {
    return `${name} is over the §4104 threshold and is missing: ${list}. The bid will be tossed at bid open.`;
  }
  return `${name} is within the §4104 borderline band and is missing: ${list}. Tighten up before submit.`;
}
