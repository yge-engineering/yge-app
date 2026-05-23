// Year-end close checklist.
//
// Bookkeeping shop has a 12-step ritual at year-end:
//   1. All AP for the year recorded + posted.
//   2. All AR billed + posted, retention split out.
//   3. Bank recs done through 12/31.
//   4. Payroll YTD reconciled to QuickBooks (or YGE GL).
//   5. CPRs filed weekly through 12/31.
//   6. 1099-NEC worksheets generated + reviewed.
//   7. Fixed-asset register has all CY adds + dispositions.
//   8. Depreciation schedule posted for the year.
//   9. WIP report frozen + signed by Ryan.
//  10. WC year-end audit packet exported.
//  11. Tax CPA copy (PDF + CSVs) emailed to the accountant.
//  12. CY books locked, prior-period adjustments only.
//
// This module is the data model + a derivation helper that takes
// the company's current state (counts of unposted AP, last bank-rec
// statement date, etc.) and returns each step's current status
// (TODO / IN_PROGRESS / DONE / BLOCKED) with a short next-action
// sentence.
//
// Pure derivation. No DB.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const YearEndStepKindSchema = z.enum([
  'AP_POSTED',
  'AR_BILLED',
  'BANK_RECS_DONE',
  'PAYROLL_RECONCILED',
  'CPRS_FILED',
  'TAX_1099_WORKSHEETS',
  'FIXED_ASSETS_UPDATED',
  'DEPRECIATION_POSTED',
  'WIP_FROZEN',
  'WC_AUDIT_EXPORT',
  'TAX_CPA_PACKAGE',
  'BOOKS_LOCKED',
]);
export type YearEndStepKind = z.infer<typeof YearEndStepKindSchema>;

export const YearEndStepStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
]);
export type YearEndStepStatus = z.infer<typeof YearEndStepStatusSchema>;

export interface YearEndStep {
  kind: YearEndStepKind;
  /** 1-based for printable display. */
  order: number;
  title: string;
  /** Plain-English next action when status != DONE. */
  nextAction: string;
  status: YearEndStepStatus;
}

export interface YearEndStateInput {
  /** Last day of the closing year (yyyy-mm-dd). Normally `2026-12-31`. */
  yearEndDate: string;
  /** Count of AP invoices for the year that aren't posted to GL yet. */
  apUnpostedCount: number;
  /** Count of AR invoices for the year that aren't posted to GL yet. */
  arUnpostedCount: number;
  /** Last reconciled bank-rec statement date, yyyy-mm-dd or null. */
  lastBankRecDate: string | null;
  /** True when the payroll register's YTD totals tie to the GL. */
  payrollReconciled: boolean;
  /** Count of WEEKS still missing a CPR through year-end (across all
   *  PW jobs that were active that week). 0 = all filed. */
  cprMissingWeeks: number;
  /** True when the 1099-NEC worksheets have been generated + reviewed. */
  tax1099Reviewed: boolean;
  /** True when the fixed-asset register has been updated through year-end. */
  fixedAssetsUpdated: boolean;
  /** True when CY depreciation has been posted to GL. */
  depreciationPosted: boolean;
  /** True when WIP report has been frozen (signed) by Ryan. */
  wipFrozen: boolean;
  /** True when the WC year-end audit packet has been exported. */
  wcAuditExported: boolean;
  /** True when the tax CPA package has been emailed. */
  taxCpaPackageSent: boolean;
  /** True when CY books are locked (no further posts allowed). */
  booksLocked: boolean;
}

/** Build the per-step checklist from current state. Pure. */
export function buildYearEndChecklist(state: YearEndStateInput): YearEndStep[] {
  const yearEnd = state.yearEndDate;
  const bankUpToDate =
    state.lastBankRecDate !== null && state.lastBankRecDate >= yearEnd;
  return [
    {
      kind: 'AP_POSTED',
      order: 1,
      title: 'All AP for the year recorded + posted',
      nextAction:
        state.apUnpostedCount === 0
          ? 'All AP posted.'
          : `Post ${state.apUnpostedCount} unposted AP invoice${state.apUnpostedCount === 1 ? '' : 's'} from the GL posting-status page.`,
      status: state.apUnpostedCount === 0 ? 'DONE' : 'IN_PROGRESS',
    },
    {
      kind: 'AR_BILLED',
      order: 2,
      title: 'All AR billed + posted (retention split out)',
      nextAction:
        state.arUnpostedCount === 0
          ? 'All AR posted.'
          : `Post ${state.arUnpostedCount} unposted AR invoice${state.arUnpostedCount === 1 ? '' : 's'}.`,
      status: state.arUnpostedCount === 0 ? 'DONE' : 'IN_PROGRESS',
    },
    {
      kind: 'BANK_RECS_DONE',
      order: 3,
      title: 'Bank recs done through year-end',
      nextAction: bankUpToDate
        ? 'Bank recs current.'
        : `Last bank rec was ${state.lastBankRecDate ?? 'never'}. Reconcile through ${yearEnd}.`,
      status: bankUpToDate ? 'DONE' : 'TODO',
    },
    {
      kind: 'PAYROLL_RECONCILED',
      order: 4,
      title: 'Payroll YTD reconciled to GL',
      nextAction: state.payrollReconciled
        ? 'Payroll reconciled.'
        : 'Tie the payroll register YTD totals to the GL wages account.',
      status: state.payrollReconciled ? 'DONE' : 'TODO',
    },
    {
      kind: 'CPRS_FILED',
      order: 5,
      title: 'Weekly CPRs filed through year-end',
      nextAction:
        state.cprMissingWeeks === 0
          ? 'All CPRs filed.'
          : `${state.cprMissingWeeks} CPR week${state.cprMissingWeeks === 1 ? '' : 's'} still missing — file before year-end close.`,
      status: state.cprMissingWeeks === 0 ? 'DONE' : 'IN_PROGRESS',
    },
    {
      kind: 'TAX_1099_WORKSHEETS',
      order: 6,
      title: '1099-NEC worksheets generated + reviewed',
      nextAction: state.tax1099Reviewed
        ? '1099 worksheets reviewed.'
        : 'Generate from /1099-worksheet, review for completeness, request missing W-9s.',
      status: state.tax1099Reviewed ? 'DONE' : 'TODO',
    },
    {
      kind: 'FIXED_ASSETS_UPDATED',
      order: 7,
      title: 'Fixed-asset register has CY adds + dispositions',
      nextAction: state.fixedAssetsUpdated
        ? 'Fixed-asset register current.'
        : 'Walk the yard + truck list, add new equipment + retire disposed assets.',
      status: state.fixedAssetsUpdated ? 'DONE' : 'TODO',
    },
    {
      kind: 'DEPRECIATION_POSTED',
      order: 8,
      title: 'Depreciation posted for the year',
      nextAction: state.depreciationPosted
        ? 'Depreciation posted.'
        : 'Post the depreciation JE from /fixed-assets.',
      status: state.depreciationPosted
        ? 'DONE'
        : state.fixedAssetsUpdated
          ? 'TODO'
          : 'BLOCKED',
    },
    {
      kind: 'WIP_FROZEN',
      order: 9,
      title: 'WIP report frozen + signed',
      nextAction: state.wipFrozen
        ? 'WIP frozen.'
        : 'Generate WIP, review with Ryan, capture the signed PDF in the doc vault.',
      status: state.wipFrozen ? 'DONE' : 'TODO',
    },
    {
      kind: 'WC_AUDIT_EXPORT',
      order: 10,
      title: 'WC year-end audit packet exported',
      nextAction: state.wcAuditExported
        ? 'WC audit exported.'
        : 'Export from /wc-audit-export, save PDF + CSV to the doc vault.',
      status: state.wcAuditExported ? 'DONE' : 'TODO',
    },
    {
      kind: 'TAX_CPA_PACKAGE',
      order: 11,
      title: 'Tax CPA package emailed',
      nextAction: state.taxCpaPackageSent
        ? 'CPA package sent.'
        : 'Bundle the YE financials + 1099 worksheets + WIP + WC audit, email to CPA.',
      status: state.taxCpaPackageSent
        ? 'DONE'
        : everythingElseDoneExcept(state, ['booksLocked', 'taxCpaPackageSent'])
          ? 'TODO'
          : 'BLOCKED',
    },
    {
      kind: 'BOOKS_LOCKED',
      order: 12,
      title: 'CY books locked',
      nextAction: state.booksLocked
        ? 'Books locked.'
        : 'After the CPA has the package, lock the books from the admin / bookkeeping settings page.',
      status: state.booksLocked
        ? 'DONE'
        : state.taxCpaPackageSent
          ? 'TODO'
          : 'BLOCKED',
    },
  ];
}

/** Roll-up — share of steps that are DONE. */
export function progressPct(steps: YearEndStep[]): number {
  if (steps.length === 0) return 1;
  const done = steps.filter((s) => s.status === 'DONE').length;
  return round4(done / steps.length);
}

/** Convenience — just the steps that need work. */
export function openSteps(steps: YearEndStep[]): YearEndStep[] {
  return steps.filter((s) => s.status !== 'DONE');
}

function everythingElseDoneExcept(
  state: YearEndStateInput,
  exceptKeys: Array<keyof YearEndStateInput>,
): boolean {
  const except = new Set(exceptKeys);
  const flags: Array<[keyof YearEndStateInput, boolean]> = [
    ['apUnpostedCount', state.apUnpostedCount === 0],
    ['arUnpostedCount', state.arUnpostedCount === 0],
    ['lastBankRecDate', state.lastBankRecDate !== null && state.lastBankRecDate >= state.yearEndDate],
    ['payrollReconciled', state.payrollReconciled],
    ['cprMissingWeeks', state.cprMissingWeeks === 0],
    ['tax1099Reviewed', state.tax1099Reviewed],
    ['fixedAssetsUpdated', state.fixedAssetsUpdated],
    ['depreciationPosted', state.depreciationPosted],
    ['wipFrozen', state.wipFrozen],
    ['wcAuditExported', state.wcAuditExported],
  ];
  return flags.every(([k, ok]) => except.has(k) || ok);
}

function round4(n: number): number {
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}

// Re-export schema for the ISO_DATE consumer.
export const YearEndStateInputSchema = z.object({
  yearEndDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  apUnpostedCount: z.number().int().nonnegative(),
  arUnpostedCount: z.number().int().nonnegative(),
  lastBankRecDate: z.string().regex(ISO_DATE).nullable(),
  payrollReconciled: z.boolean(),
  cprMissingWeeks: z.number().int().nonnegative(),
  tax1099Reviewed: z.boolean(),
  fixedAssetsUpdated: z.boolean(),
  depreciationPosted: z.boolean(),
  wipFrozen: z.boolean(),
  wcAuditExported: z.boolean(),
  taxCpaPackageSent: z.boolean(),
  booksLocked: z.boolean(),
});
