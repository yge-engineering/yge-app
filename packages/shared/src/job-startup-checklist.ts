// Job startup checklist generator.
//
// Plain English: YGE just won a bid. There are 8–12 things that have
// to happen before the first crew rolls. Forgetting one of them costs
// money — late DAS-140 = DIR fine; no §4104 sub-list update = bid
// non-responsive; no IIPP delivered = Cal/OSHA exposure.
//
// This helper builds the per-job startup checklist from the project
// type + the owner-agency compliance posture (bundle 2548). The list
// is the union of: common items every YGE job needs, plus per-agency
// items that only apply when the compliance flags say they do.

import type { PtoEProjectType } from './plans-to-estimate-output';
import type { OwnerAgencyClassification } from './owner-agency';

/** Severity drives sort + UI highlighting. */
export type StartupItemSeverity = 'critical' | 'standard';

export interface JobStartupItem {
  id: string;
  label: string;
  detail?: string;
  severity: StartupItemSeverity;
  /** Plain-English category for filtering / grouping. */
  category:
    | 'COMPLIANCE'
    | 'SUBCONTRACTS'
    | 'FIELD'
    | 'PAPERWORK'
    | 'SAFETY';
}

export interface JobStartupChecklist {
  items: JobStartupItem[];
  /** True iff every critical item is included by construction (a
   *  sanity flag so the UI banner can read "Critical items present").
   *  Caller decides what to do with un-checked critical items. */
  hasCriticalItems: boolean;
}

export interface BuildJobStartupInput {
  projectType: PtoEProjectType;
  /** Agency classification from classifyOwnerAgency. */
  classification: OwnerAgencyClassification;
  /** True iff the awarded bid listed any subcontractors per §4104.
   *  Drives the "send sub-list update to agency" item. */
  hasListedSubs: boolean;
  /** Awarded contract amount in cents. Drives the bond-required
   *  threshold (CA public works ≥ $25K requires payment + perf
   *  bonds; most agencies push that higher). When undefined, the
   *  bond item is included as a precaution. */
  awardedAmountCents?: number;
}

/** Default cutoff (cents) above which the bond items get added.
 *  $25,000 mirrors the CA mechanics-lien / surety-bond threshold. */
const BOND_THRESHOLD_CENTS = 25_000_00;

export function buildJobStartupChecklist(
  input: BuildJobStartupInput,
): JobStartupChecklist {
  const c = input.classification.compliance;
  const items: JobStartupItem[] = [];

  // ---- Compliance ----
  if (c.das140Required) {
    items.push({
      id: 'das-140',
      label: 'File DAS-140 with DIR + dispatch to each apprenticeship JATC',
      detail: 'Within 5 business days of award; one per craft you employ.',
      severity: 'critical',
      category: 'COMPLIANCE',
    });
  }
  if (input.hasListedSubs && c.subListingRequired) {
    items.push({
      id: 'sub-list-to-agency',
      label: 'Send finalized §4104 designated-subcontractor list to agency',
      detail: 'Required pre-execution; substitutions go through PCC §4107.',
      severity: 'critical',
      category: 'PAPERWORK',
    });
  }
  if (c.davisBacon) {
    items.push({
      id: 'davis-bacon-wd',
      label: 'Confirm Davis-Bacon wage determination on file for the job site',
      detail: 'Federal funding pulls in Davis-Bacon on top of (or instead of) CA PW.',
      severity: 'critical',
      category: 'COMPLIANCE',
    });
  }
  if (c.swpppLikely) {
    items.push({
      id: 'swppp',
      label: 'Prepare / submit SWPPP + NOI to State Water Board',
      detail: 'NPDES general permit triggers ≥ 1 acre disturbed (Caltrans most jobs).',
      severity: 'standard',
      category: 'COMPLIANCE',
    });
  }
  if (c.prevailingWage) {
    items.push({
      id: 'pw-fringe-update',
      label: 'Pull current DIR PW + fringe rates for each craft you\'ll employ',
      detail: 'Rates revise Feb 22 + Aug 22; lock the rate effective at start.',
      severity: 'standard',
      category: 'COMPLIANCE',
    });
  }

  // ---- Subcontracts ----
  if (input.hasListedSubs) {
    items.push({
      id: 'sub-agreements',
      label: 'Draft + issue subcontract agreements to listed subs',
      detail: 'Use YGE master subcontract; tailor scope + retention per project.',
      severity: 'standard',
      category: 'SUBCONTRACTS',
    });
    items.push({
      id: 'sub-coi',
      label: 'Collect updated COI + W-9 from each listed sub',
      detail: 'Verify additional-insured language matches owner contract.',
      severity: 'standard',
      category: 'SUBCONTRACTS',
    });
  }

  // ---- Paperwork ----
  if (
    input.awardedAmountCents == null ||
    input.awardedAmountCents >= BOND_THRESHOLD_CENTS
  ) {
    items.push({
      id: 'bonds',
      label: 'Issue payment + performance bonds, deliver to agency',
      detail: '100% of contract amount each (CA public works default).',
      severity: 'critical',
      category: 'PAPERWORK',
    });
  }
  items.push({
    id: 'insurance-cert',
    label: 'Project-specific COI with owner additional insured',
    detail: 'GL + Auto + WC minimums per the spec; deliver before NTP.',
    severity: 'critical',
    category: 'PAPERWORK',
  });
  items.push({
    id: 'notice-of-award-ack',
    label: 'Sign + return Notice of Award (or Contract)',
    severity: 'critical',
    category: 'PAPERWORK',
  });
  items.push({
    id: 'pre-con-meeting',
    label: 'Schedule pre-construction meeting with agency + key subs',
    severity: 'standard',
    category: 'FIELD',
  });

  // ---- Field ----
  items.push({
    id: 'permits',
    label: 'Pull encroachment + building / grading permits',
    severity: 'critical',
    category: 'FIELD',
  });
  items.push({
    id: 'usa-dig',
    label: 'Submit USA dig-alert tickets prior to excavation',
    detail: 'Two working days minimum notice before any digging.',
    severity: 'critical',
    category: 'FIELD',
  });
  if (
    input.projectType === 'ROAD_RECONSTRUCTION' ||
    input.projectType === 'BRIDGE'
  ) {
    items.push({
      id: 'traffic-control-plan',
      label: 'Finalize + submit traffic-control plan',
      detail: 'Required pre-mobilization for most NorCal jurisdictions.',
      severity: 'critical',
      category: 'FIELD',
    });
  }
  if (input.projectType === 'FIRE_FUEL_REDUCTION') {
    items.push({
      id: 'cal-fire-fire-watch',
      label: 'Confirm fire-watch arrangement + water truck staged',
      detail: 'CAL FIRE typically requires fire watch during + after operations.',
      severity: 'critical',
      category: 'FIELD',
    });
  }

  // ---- Safety ----
  items.push({
    id: 'iipp-job-specific',
    label: 'Issue job-specific IIPP + site safety plan to foreman',
    severity: 'critical',
    category: 'SAFETY',
  });
  items.push({
    id: 'jsa-initial',
    label: 'Conduct initial JSA + first toolbox talk on Day 1',
    severity: 'standard',
    category: 'SAFETY',
  });

  return {
    items,
    hasCriticalItems: items.some((i) => i.severity === 'critical'),
  };
}
