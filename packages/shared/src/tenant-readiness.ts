// Tenant readiness check.
//
// /api-status answers "is the platform running?" — infrastructure
// view. This module answers "is THIS company's tenant data
// populated enough to actually run a real bid?" — the
// configuration view. Designed for the go-live checklist Ryan
// works through before flipping app.youngge.com from staging to
// production.
//
// Each check returns one of:
//   - 'ready'    — populated and usable
//   - 'partial'  — usable but incomplete (e.g. some rates loaded
//                  but not all)
//   - 'missing'  — blank, would crash or render empty when
//                  exercised
//
// Pure data-in / data-out. The caller (web page) collects the
// counts from the DB and hands them to runTenantReadiness.

export type TenantReadinessStatus = 'ready' | 'partial' | 'missing';

export interface TenantReadinessCheckResult {
  /** Stable id for telemetry / linking. */
  key: string;
  /** Short label for the UI row. */
  label: string;
  status: TenantReadinessStatus;
  /** Plain-English explanation. Always present, even on 'ready'
   *  so the row can show what made it ready. */
  detail: string;
  /** Next-step prompt when status is not 'ready'. UI surfaces
   *  this with a link/button to the relevant settings page. */
  remediation?: string;
  /** Optional deep-link to the page that fixes this. */
  fixHref?: string;
}

/** Snapshot of tenant-level counts the readiness check needs.
 *  Caller fetches each from its source (Prisma / API) and
 *  passes a complete object in. */
export interface TenantReadinessInputs {
  /** Whether YGE_COMPANY_INFO has been replaced with a DB-backed
   *  master profile row. Today: always false until the Phase 1
   *  MVP item #6 edit form ships. */
  hasMasterProfile: boolean;
  /** Whether the bonding profile seed (or DB row) is populated. */
  hasBondingProfile: boolean;
  /** Whether the insurance profile seed (or DB row) has at least
   *  GL / Auto / WC. */
  hasInsuranceProfile: boolean;
  /** How many labor rate rows are loaded. */
  laborRateCount: number;
  /** How many equipment rate rows are loaded. */
  equipmentRateCount: number;
  /** How many material rows are loaded. */
  materialCount: number;
  /** Count of customers / agencies in the system. */
  customerCount: number;
  /** Count of estimates ever created. */
  estimateCount: number;
  /** Count of Plans-to-Estimate drafts ever saved. */
  draftCount: number;
  /** Count of seeded PDF form mappings that have been reviewed. */
  reviewedPdfFormCount: number;
  /** Total seeded PDF form mappings. */
  totalPdfFormCount: number;
}

export interface TenantReadinessReport {
  /** Worst status across all checks — 'missing' beats 'partial'
   *  beats 'ready'. The go-live banner uses this for color. */
  overallStatus: TenantReadinessStatus;
  /** Count of checks at each status. */
  counts: {
    ready: number;
    partial: number;
    missing: number;
  };
  checks: TenantReadinessCheckResult[];
}

const RATE_READY_THRESHOLD = 20;     // arbitrary minimum to call rates "ready"
const RATE_PARTIAL_THRESHOLD = 1;    // any rows = partial

export function runTenantReadiness(
  input: TenantReadinessInputs,
): TenantReadinessReport {
  const checks: TenantReadinessCheckResult[] = [
    masterProfileCheck(input.hasMasterProfile),
    bondingCheck(input.hasBondingProfile),
    insuranceCheck(input.hasInsuranceProfile),
    rateBookCheck(
      'labor',
      'Labor rates',
      input.laborRateCount,
      '/rates/import',
    ),
    rateBookCheck(
      'equipment',
      'Equipment rates',
      input.equipmentRateCount,
      '/rates/import',
    ),
    rateBookCheck(
      'material',
      'Material rates',
      input.materialCount,
      '/rates/import',
    ),
    customersCheck(input.customerCount),
    estimateActivityCheck(input.estimateCount, input.draftCount),
    pdfFormReviewCheck(input.reviewedPdfFormCount, input.totalPdfFormCount),
  ];

  const counts = { ready: 0, partial: 0, missing: 0 };
  for (const c of checks) counts[c.status] += 1;

  const overallStatus: TenantReadinessStatus =
    counts.missing > 0 ? 'missing' : counts.partial > 0 ? 'partial' : 'ready';

  return { overallStatus, counts, checks };
}

function masterProfileCheck(populated: boolean): TenantReadinessCheckResult {
  if (populated) {
    return {
      key: 'master-profile',
      label: 'Master business profile',
      status: 'ready',
      detail: 'Editable profile populated.',
    };
  }
  return {
    key: 'master-profile',
    label: 'Master business profile',
    status: 'partial',
    detail: 'Reading from static YGE_COMPANY_INFO. Usable for forms today.',
    remediation:
      'Phase 1 MVP item #6: ship DB-backed master profile + edit form.',
    fixHref: '/settings/company',
  };
}

function bondingCheck(populated: boolean): TenantReadinessCheckResult {
  if (populated) {
    return {
      key: 'bonding-profile',
      label: 'Bonding profile',
      status: 'ready',
      detail: 'Surety + capacity values configured.',
    };
  }
  return {
    key: 'bonding-profile',
    label: 'Bonding profile',
    status: 'missing',
    detail: 'No surety / capacity numbers configured.',
    remediation:
      'Edit YGE_BONDING_PROFILE in packages/shared/src/company.ts (or wait for the DB edit form).',
    fixHref: '/settings/company',
  };
}

function insuranceCheck(populated: boolean): TenantReadinessCheckResult {
  if (populated) {
    return {
      key: 'insurance-profile',
      label: 'Insurance profile',
      status: 'ready',
      detail: 'GL / Auto / WC carriers configured.',
    };
  }
  return {
    key: 'insurance-profile',
    label: 'Insurance profile',
    status: 'missing',
    detail: 'No GL / Auto / WC carriers configured. ACORD-25 fills will fail.',
    remediation:
      'Edit YGE_INSURANCE_PROFILE in packages/shared/src/company.ts.',
    fixHref: '/settings/company',
  };
}

function rateBookCheck(
  key: string,
  label: string,
  count: number,
  fixHref: string,
): TenantReadinessCheckResult {
  if (count >= RATE_READY_THRESHOLD) {
    return {
      key: `rate-${key}`,
      label,
      status: 'ready',
      detail: `${count} rows loaded.`,
    };
  }
  if (count >= RATE_PARTIAL_THRESHOLD) {
    return {
      key: `rate-${key}`,
      label,
      status: 'partial',
      detail: `Only ${count} rows loaded; minimum recommended is ${RATE_READY_THRESHOLD}.`,
      remediation: 'Import more rates from the Excel master.',
      fixHref,
    };
  }
  return {
    key: `rate-${key}`,
    label,
    status: 'missing',
    detail: 'No rows loaded — AI estimates fall back to generic NorCal averages.',
    remediation: 'Import the Excel master rate book.',
    fixHref,
  };
}

function customersCheck(count: number): TenantReadinessCheckResult {
  if (count > 0) {
    return {
      key: 'customers',
      label: 'Customers / agencies',
      status: 'ready',
      detail: `${count} on file.`,
    };
  }
  return {
    key: 'customers',
    label: 'Customers / agencies',
    status: 'missing',
    detail: 'No customers loaded. New estimates have no agency to assign.',
    remediation: 'Import customers from QBO or add manually.',
    fixHref: '/customers',
  };
}

function estimateActivityCheck(
  estimates: number,
  drafts: number,
): TenantReadinessCheckResult {
  if (estimates >= 1 || drafts >= 1) {
    return {
      key: 'estimate-activity',
      label: 'Estimate activity',
      status: 'ready',
      detail: `${estimates} priced estimate(s), ${drafts} AI draft(s).`,
    };
  }
  return {
    key: 'estimate-activity',
    label: 'Estimate activity',
    status: 'missing',
    detail: 'No estimates or drafts created yet — exercise the pipeline once.',
    remediation: 'Upload a plan set or create a manual estimate.',
    fixHref: '/plans-to-estimate',
  };
}

function pdfFormReviewCheck(
  reviewed: number,
  total: number,
): TenantReadinessCheckResult {
  if (total === 0) {
    return {
      key: 'pdf-form-review',
      label: 'PDF form library review',
      status: 'missing',
      detail: 'No PDF form mappings seeded.',
      remediation: 'Run the pdf-form-mappings seed.',
      fixHref: '/pdf-forms',
    };
  }
  if (reviewed === total) {
    return {
      key: 'pdf-form-review',
      label: 'PDF form library review',
      status: 'ready',
      detail: `All ${total} mappings reviewed.`,
    };
  }
  if (reviewed > 0) {
    return {
      key: 'pdf-form-review',
      label: 'PDF form library review',
      status: 'partial',
      detail: `${reviewed} of ${total} reviewed. Un-reviewed forms refuse to auto-fill.`,
      remediation: 'Walk the queue and flip reviewed=true once each mapping is verified.',
      fixHref: '/pdf-forms',
    };
  }
  return {
    key: 'pdf-form-review',
    label: 'PDF form library review',
    status: 'partial',
    detail: `0 of ${total} reviewed. Form filler will refuse all auto-fills until reviewed=true.`,
    remediation: 'Walk the queue and flip reviewed=true once each mapping is verified.',
    fixHref: '/pdf-forms',
  };
}
