// Records retention engine — rules + helpers.
//
// Project plan v6.2 lists 'records retention + legal hold engine
// that knows IRS/CA wage/DIR/OSHA/I-9 retention rules, auto-purges
// on schedule with review confirmation, and freezes every record
// on a job the moment a hold is applied'. This module is the
// rules table + the eligibility helper. Persistence + the
// review-and-purge UI build on top.
//
// The retention rules below codify what the relevant agencies +
// statutes require. Conservatives default to 'keep longer than
// the minimum' — when in doubt the rule extends rather than
// truncates. Specific authorities cited per row.

import type { AuditEntityType } from './audit';

export type RecordRetentionAuthority =
  | 'IRS'
  | 'CA_LABOR_CODE'
  | 'CA_DIR'
  | 'CAL_OSHA'
  | 'FEDERAL_OSHA'
  | 'FEDERAL_I9'
  | 'CA_DOI'
  | 'CONTRACT_CONVENTION'
  | 'YGE_INTERNAL';

export interface RecordRetentionRule {
  /** AuditEntityType (or 'CompanyDocument' alias for arbitrary
   *  company-vault uploads). */
  entityType: AuditEntityType | 'CompanyDocument';
  /** Plain-English label for the rule list UI. */
  label: string;
  /** Years from the trigger date the row must be retained. */
  retainYears: number;
  /** Trigger event that starts the retention clock. */
  trigger:
    | 'CREATED_AT'
    | 'JOB_FINAL_ACCEPTANCE'
    | 'EMPLOYEE_SEPARATION'
    | 'CONTRACT_FINAL_ACCEPTANCE'
    | 'POLICY_EXPIRATION'
    | 'INCIDENT_DATE';
  /** Statutory / regulatory authority this rule comes from. */
  authority: RecordRetentionAuthority;
  /** Citation — section number / regulation name. Helps the auditor
   *  trace the rule to its source. */
  citation: string;
  /** Free-form note (qualifications, edge cases). */
  note?: string;
}

/**
 * The seeded rules table. Add new rows when a new entityType is
 * introduced or when an authority's retention requirement changes.
 * Rules are checked at purge time + at legal-hold lookup time.
 */
export const RETENTION_RULES: ReadonlyArray<RecordRetentionRule> = [
  // ---- Tax + finance ----
  {
    entityType: 'JournalEntry',
    label: 'General-ledger journal entries',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'IRC §6501 (statute of limitations on assessment is 3 years; 6 years on substantial under-reporting; 7 years covers loss-claim and bad-debt records under the §165 regs).',
  },
  {
    entityType: 'ApInvoice',
    label: 'Vendor invoices (AP)',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'Same as JournalEntry — supporting documentation for tax filings.',
  },
  {
    entityType: 'ApPayment',
    label: 'AP payments',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'Treas. Reg. §1.6001-1(a) — books and records.',
  },
  {
    entityType: 'ArInvoice',
    label: 'Customer invoices (AR)',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'Treas. Reg. §1.6001-1(a).',
  },
  {
    entityType: 'ArPayment',
    label: 'AR payments',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'Treas. Reg. §1.6001-1(a).',
  },
  {
    entityType: 'BankRec',
    label: 'Bank reconciliations',
    retainYears: 7,
    trigger: 'CREATED_AT',
    authority: 'IRS',
    citation: 'Treas. Reg. §1.6001-1(a) — records of bank transactions.',
  },
  // ---- CA wage + payroll ----
  {
    entityType: 'TimeCard',
    label: 'Time cards / time records',
    retainYears: 4,
    trigger: 'CREATED_AT',
    authority: 'CA_LABOR_CODE',
    citation: 'Cal. Lab. Code §1174(d) — 4 years for time + payroll records.',
  },
  {
    entityType: 'CertifiedPayroll',
    label: 'Certified payroll reports (CPRs)',
    retainYears: 5,
    trigger: 'JOB_FINAL_ACCEPTANCE',
    authority: 'CA_DIR',
    citation: '8 CCR §16400 — 3 years post-completion; YGE policy is 5 to cover audit windows + statute of limitations on PWC claims.',
  },
  {
    entityType: 'DirRateSchedule',
    label: 'DIR prevailing wage determinations',
    retainYears: 5,
    trigger: 'CREATED_AT',
    authority: 'CA_DIR',
    citation: '8 CCR §16404.',
  },
  // ---- OSHA + safety ----
  {
    entityType: 'Incident',
    label: 'OSHA 300-series incident records',
    retainYears: 5,
    trigger: 'INCIDENT_DATE',
    authority: 'CAL_OSHA',
    citation: '8 CCR §14300.33 — 5 years following the calendar year the record covers.',
  },
  {
    entityType: 'ToolboxTalk',
    label: 'Toolbox-talk attendance',
    retainYears: 5,
    trigger: 'CREATED_AT',
    authority: 'CAL_OSHA',
    citation: '8 CCR §1509(g) — IIPP records, including training, retained 1 yr; YGE policy is 5 to align with OSHA 300.',
  },
  {
    entityType: 'SwpppInspection',
    label: 'SWPPP inspections',
    retainYears: 5,
    trigger: 'CREATED_AT',
    authority: 'CA_DIR',
    citation: 'CA SWRCB Order 2009-0009-DWQ — 3-year minimum; YGE policy 5 to cover claim windows.',
  },
  {
    entityType: 'EmployeeCertification',
    label: 'Training / certification records',
    retainYears: 30,
    trigger: 'EMPLOYEE_SEPARATION',
    authority: 'FEDERAL_OSHA',
    citation: '29 CFR 1910.1020(d) — medical / exposure records retained 30 years past separation; training records ride along with employee files.',
    note: 'Some training records (e.g. forklift certs) only require 3 years; YGE policy is the longest applicable for safety since the cost of keeping them is small and the cost of being unable to produce them is large.',
  },
  // ---- HR ----
  {
    entityType: 'Employee',
    label: 'Employee personnel file',
    retainYears: 4,
    trigger: 'EMPLOYEE_SEPARATION',
    authority: 'CA_LABOR_CODE',
    citation: 'Cal. Lab. Code §1198.5 — 3 years post-separation; YGE policy 4 to cover statute-of-limitations padding.',
  },
  // ---- I-9 (federal) ----
  // I-9 retention is a separate document type from the Employee
  // record itself; track via a Document with retentionRuleKey on
  // upload. Listed here for completeness.
  {
    entityType: 'CompanyDocument',
    label: 'I-9 employment eligibility verification',
    retainYears: 3,
    trigger: 'EMPLOYEE_SEPARATION',
    authority: 'FEDERAL_I9',
    citation: '8 CFR 274a.2(b)(2)(i) — later of 3 years past hire or 1 year past termination. YGE rule = 3 years past separation (covers both branches).',
    note: 'Applies only to documents tagged i9=true at upload time.',
  },
  // ---- Contracts / agreements ----
  {
    entityType: 'Job',
    label: 'Job records (contracts, COs, CPRs binder)',
    retainYears: 10,
    trigger: 'JOB_FINAL_ACCEPTANCE',
    authority: 'CONTRACT_CONVENTION',
    citation: 'Cal. Code Civ. Proc. §337 (4-year statute on written contracts) + §337.15 (10-year limit on construction defect actions). YGE policy = 10 to cover defect window.',
  },
  {
    entityType: 'ChangeOrder',
    label: 'Change orders',
    retainYears: 10,
    trigger: 'JOB_FINAL_ACCEPTANCE',
    authority: 'CONTRACT_CONVENTION',
    citation: 'Same as Job — defect window.',
  },
  {
    entityType: 'LienWaiver',
    label: 'Lien waivers',
    retainYears: 10,
    trigger: 'JOB_FINAL_ACCEPTANCE',
    authority: 'CONTRACT_CONVENTION',
    citation: 'CA stop-notice and lien claims accrue against post-completion windows; 10 years matches the construction defect ceiling.',
  },
  // ---- Insurance ----
  {
    entityType: 'CompanyDocument',
    label: 'Insurance certificates / COIs',
    retainYears: 7,
    trigger: 'POLICY_EXPIRATION',
    authority: 'CA_DOI',
    citation: 'Cal. Ins. Code §10508 — insurer record-retention is 5 years; YGE policy is 7 to extend through any loss claim that emerges late.',
    note: 'Applies to documents tagged kind=insurance-cert / acord-25.',
  },
];

/**
 * Resolve every retention rule that applies to a given entity
 * type. Most types map to exactly one rule, but some (CompanyDocument)
 * carry rules per sub-classification — the caller threads the
 * sub-tag through and filters on the `note` if needed.
 */
export function rulesFor(entityType: AuditEntityType | 'CompanyDocument'): RecordRetentionRule[] {
  return RETENTION_RULES.filter((r) => r.entityType === entityType);
}

/**
 * Compute the earliest date a record can be purged given the
 * trigger date that starts the clock. Returns yyyy-mm-dd.
 *
 * The trigger date is supplied by the caller because the resolver
 * doesn't know whether 'CREATED_AT' for a JournalEntry means the
 * entry's createdAt or the period closing date — that's a policy
 * choice the API edge makes.
 */
export function purgeEligibleOn(
  rule: RecordRetentionRule,
  triggerDateIso: string,
): string {
  const trigger = new Date(triggerDateIso + (triggerDateIso.includes('T') ? '' : 'T00:00:00Z'));
  if (!Number.isFinite(trigger.getTime())) {
    return ''; // unparseable
  }
  const purge = new Date(trigger.getTime());
  purge.setUTCFullYear(purge.getUTCFullYear() + rule.retainYears);
  return purge.toISOString().slice(0, 10);
}

/**
 * Whether a record is past its purge date. Caller still has to
 * intersect with legal-hold state before actually deleting.
 */
export function isPurgeEligible(
  rule: RecordRetentionRule,
  triggerDateIso: string,
  asOfIso: string = new Date().toISOString(),
): boolean {
  const eligible = purgeEligibleOn(rule, triggerDateIso);
  if (!eligible) return false;
  return asOfIso.slice(0, 10) >= eligible;
}

export interface RecordRetentionStats {
  /** Total rules in the table. */
  total: number;
  /** Rule count by authority — drives the 'rules by source' tile. */
  byAuthority: Record<RecordRetentionAuthority, number>;
  /** Longest retention period in the table (for the 'maximum
   *  retention' summary). */
  longestRetainYears: number;
  /** Rule with the longest retention. */
  longestRule: RecordRetentionRule | null;
}

export function computeRetentionStats(): RecordRetentionStats {
  const byAuthority: Record<RecordRetentionAuthority, number> = {
    IRS: 0,
    CA_LABOR_CODE: 0,
    CA_DIR: 0,
    CAL_OSHA: 0,
    FEDERAL_OSHA: 0,
    FEDERAL_I9: 0,
    CA_DOI: 0,
    CONTRACT_CONVENTION: 0,
    YGE_INTERNAL: 0,
  };
  let longest: RecordRetentionRule | null = null;
  for (const r of RETENTION_RULES) {
    byAuthority[r.authority] += 1;
    if (!longest || r.retainYears > longest.retainYears) longest = r;
  }
  return {
    total: RETENTION_RULES.length,
    byAuthority,
    longestRetainYears: longest?.retainYears ?? 0,
    longestRule: longest,
  };
}
