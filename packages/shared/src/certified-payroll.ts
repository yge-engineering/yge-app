// Certified Payroll Record (CPR) — California DIR weekly report.
//
// Required weekly on every public-works job during the time work is
// performed. Each CPR covers one job for one week. Reports each
// employee's classification, hours worked per day, base wage rate,
// fringe benefits, and the standard-vs-overtime split. Submitted to
// DIR's eCPR portal in WH-347 / DIR XML format; this module captures
// the same data the form does, in a more structured shape.
//
// In Phase 1 we capture the report itself and let the user export to
// CSV / XML in a later add-on. The data model matches the federal
// WH-347 form columns so the export is mechanical when it lands.
//
// Source for hours: time cards (preferred). When the time-card-builder
// hasn't run yet, the foreman's daily report rows can be the source.

import { z } from 'zod';
import { DirClassificationSchema } from './employee';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const CprStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'AMENDED',
  'NON_PERFORMANCE',  // 'no work performed this week' filing
]);
export type CprStatus = z.infer<typeof CprStatusSchema>;

/** Per-employee row on a weekly CPR. Mirrors WH-347 column structure. */
export const CprEmployeeRowSchema = z.object({
  employeeId: z.string().min(1).max(60),
  /** Snapshot of name in case the Employee record changes after filing. */
  name: z.string().min(1).max(200),
  classification: DirClassificationSchema,
  /** Free-form trade override when classification = OTHER. */
  classificationOverride: z.string().max(120).optional(),
  /** Last 4 of SSN — DIR allows last-4 redaction on the public version. */
  ssnLast4: z.string().max(4).optional(),
  /** Daily hours per day of week (Mon..Sun, 7 entries). Decimal hours
   *  with 2-decimal precision. */
  dailyHours: z
    .array(z.number().nonnegative())
    .length(7),
  /** Total straight-time hours for the week. */
  straightHours: z.number().nonnegative().default(0),
  /** Total OT hours for the week. */
  overtimeHours: z.number().nonnegative().default(0),
  /** Base hourly rate in cents. */
  hourlyRateCents: z.number().int().nonnegative(),
  /** Total fringe benefits (per hour, cents). Health + pension +
   *  vacation + training combined. */
  fringeRateCents: z.number().int().nonnegative().default(0),
  /** Gross pay this week (cents). Computed but stored. */
  grossPayCents: z.number().int().nonnegative().default(0),
  /** Total deductions (taxes, dues, other) — for the deductions column. */
  deductionsCents: z.number().int().nonnegative().default(0),
  /** Net check amount (cents). gross - deductions. */
  netPayCents: z.number().int().nonnegative().default(0),
  /** Free-form notes per row. */
  note: z.string().max(500).optional(),
});
export type CprEmployeeRow = z.infer<typeof CprEmployeeRowSchema>;

export const CertifiedPayrollSchema = z.object({
  /** Stable id `cpr-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Project number on the contract — e.g. Cal Fire 1CA07840. */
  projectNumber: z.string().max(80).optional(),
  /** Awarding agency. */
  awardingAgency: z.string().max(200).optional(),

  /** Sequential payroll number per job. Starts at 1. */
  payrollNumber: z.number().int().nonnegative().default(1),
  /** Final payroll on the job. Triggers special handling. */
  isFinalPayroll: z.boolean().default(false),

  /** Monday of the reported week (yyyy-mm-dd). */
  weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Sunday of the reported week (yyyy-mm-dd). */
  weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  status: CprStatusSchema.default('DRAFT'),

  rows: z.array(CprEmployeeRowSchema).default([]),

  /** Statement of compliance signed flag. Cannot submit without this. */
  complianceStatementSigned: z.boolean().default(false),
  /** Officer who signs the statement of compliance. */
  signedByEmployeeId: z.string().max(60).optional(),

  submittedAt: z.string().optional(),
  acceptedAt: z.string().optional(),

  /** Free-form notes — exceptions, apprenticeship ratios, etc. */
  notes: z.string().max(10_000).optional(),
});
export type CertifiedPayroll = z.infer<typeof CertifiedPayrollSchema>;

export const CertifiedPayrollCreateSchema = CertifiedPayrollSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: CprStatusSchema.optional(),
  rows: z.array(CprEmployeeRowSchema).optional(),
  payrollNumber: z.number().int().nonnegative().optional(),
  isFinalPayroll: z.boolean().optional(),
  complianceStatementSigned: z.boolean().optional(),
});
export type CertifiedPayrollCreate = z.infer<typeof CertifiedPayrollCreateSchema>;

export const CertifiedPayrollPatchSchema = CertifiedPayrollCreateSchema.partial();
export type CertifiedPayrollPatch = z.infer<typeof CertifiedPayrollPatchSchema>;

// ---- Pure helpers --------------------------------------------------------

export function cprStatusLabel(s: CprStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `cpr.status.${s}`);
}

/** Sum a row's daily hours array. */
export function totalRowHours(row: Pick<CprEmployeeRow, 'dailyHours'>): number {
  return row.dailyHours.reduce((acc, h) => acc + h, 0);
}

/** Compute gross pay for a row from straight + OT hours and base rate.
 *  CA OT is 1.5x base. Fringe added per total hour (not OT-multiplied). */
export function computeRowPay(row: Pick<CprEmployeeRow, 'straightHours' | 'overtimeHours' | 'hourlyRateCents' | 'fringeRateCents'>): {
  straightPayCents: number;
  overtimePayCents: number;
  fringePayCents: number;
  grossPayCents: number;
} {
  const straightPayCents = Math.round(row.straightHours * row.hourlyRateCents);
  const overtimePayCents = Math.round(row.overtimeHours * row.hourlyRateCents * 1.5);
  const totalHours = row.straightHours + row.overtimeHours;
  const fringePayCents = Math.round(totalHours * row.fringeRateCents);
  return {
    straightPayCents,
    overtimePayCents,
    fringePayCents,
    grossPayCents: straightPayCents + overtimePayCents + fringePayCents,
  };
}

/** Whether a CPR can be submitted: signed, has rows (or NON_PERFORMANCE),
 *  no zero-rate rows. Returns the list of reasons it can't if any. */
export function cprSubmitBlockers(
  cpr: Pick<CertifiedPayroll, 'rows' | 'complianceStatementSigned' | 'status'>,
): string[] {
  const blockers: string[] = [];
  if (!cpr.complianceStatementSigned && cpr.status !== 'NON_PERFORMANCE') {
    blockers.push('Statement of compliance must be signed.');
  }
  if (cpr.status === 'NON_PERFORMANCE') {
    return blockers; // non-performance filings need only the signature
  }
  if (cpr.rows.length === 0) {
    blockers.push('At least one employee row is required.');
  }
  for (const row of cpr.rows) {
    if (row.hourlyRateCents <= 0) {
      blockers.push(`${row.name}: hourly rate must be > 0.`);
    }
    const totalHours = totalRowHours(row);
    if (totalHours <= 0) {
      blockers.push(`${row.name}: at least one day must have hours.`);
    }
    const sumST_OT = row.straightHours + row.overtimeHours;
    if (Math.abs(sumST_OT - totalHours) > 0.05) {
      blockers.push(`${row.name}: straight + OT hours don't match daily sum.`);
    }
  }
  return blockers;
}

export interface CprRollup {
  total: number;
  draft: number;
  submitted: number;
  accepted: number;
  nonPerformance: number;
  /** Total straight hours across all CPRs. */
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalGrossPayCents: number;
}

export function computeCprRollup(cprs: CertifiedPayroll[]): CprRollup {
  let draft = 0;
  let submitted = 0;
  let accepted = 0;
  let nonPerformance = 0;
  let totalStraightHours = 0;
  let totalOvertimeHours = 0;
  let totalGrossPayCents = 0;
  for (const c of cprs) {
    switch (c.status) {
      case 'DRAFT': draft += 1; break;
      case 'SUBMITTED': submitted += 1; break;
      case 'ACCEPTED': accepted += 1; break;
      case 'NON_PERFORMANCE': nonPerformance += 1; break;
      case 'AMENDED': submitted += 1; break;
    }
    for (const r of c.rows) {
      totalStraightHours += r.straightHours;
      totalOvertimeHours += r.overtimeHours;
      totalGrossPayCents += r.grossPayCents;
    }
  }
  return {
    total: cprs.length,
    draft,
    submitted,
    accepted,
    nonPerformance,
    totalStraightHours: Math.round(totalStraightHours * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalGrossPayCents,
  };
}

export function newCertifiedPayrollId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `cpr-${hex.padStart(8, '0')}`;
}
