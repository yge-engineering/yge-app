// Plans-to-Estimate scope-gap report.
//
// Output of the AI scope-gap check pass. The estimator reviews the
// gaps before submit; each gap can be dismissed (with a logged
// reason) or accepted (which feeds back into the bid editor as a
// suggested line item / quantity correction).

import { z } from 'zod';

export const ScopeGapSeveritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ScopeGapSeverity = z.infer<typeof ScopeGapSeveritySchema>;

export const ScopeGapCategorySchema = z.enum([
  'MISSING_LINE',
  'QUANTITY_LOW',
  'UNIT_WRONG',
  'INCIDENTAL_NOT_LINED',
  'SCOPE_AMBIGUOUS',
  'OTHER',
]);
export type ScopeGapCategory = z.infer<typeof ScopeGapCategorySchema>;

export const ScopeGapOverallStatusSchema = z.enum([
  'CLEAN',
  'MINOR_GAPS',
  'MAJOR_GAPS',
]);
export type ScopeGapOverallStatus = z.infer<typeof ScopeGapOverallStatusSchema>;

export const ScopeGapSchema = z.object({
  severity: ScopeGapSeveritySchema,
  category: ScopeGapCategorySchema,
  message: z.string().min(1).max(2000),
  specReference: z.string().max(800).optional(),
  /** When suggesting a brand-new line. */
  suggestedItemNumber: z.string().max(40).optional(),
  suggestedDescription: z.string().max(500).optional(),
  suggestedUnit: z.string().max(20).optional(),
  suggestedQuantity: z.number().nonnegative().optional(),
  /** When the gap is a quantity / unit correction on an existing line. */
  existingItemNumber: z.string().max(40).optional(),
});
export type ScopeGap = z.infer<typeof ScopeGapSchema>;

export const ScopeGapReportSchema = z.object({
  overallStatus: ScopeGapOverallStatusSchema,
  summary: z.string().max(2000).optional(),
  gaps: z.array(ScopeGapSchema).max(200),
});
export type ScopeGapReport = z.infer<typeof ScopeGapReportSchema>;

// ---- Helpers ------------------------------------------------------------

export interface ScopeGapRollup {
  total: number;
  bySeverity: Record<ScopeGapSeverity, number>;
  byCategory: Record<ScopeGapCategory, number>;
  /** Number of HIGH-severity gaps — the bid coach gates submit
   *  on this exceeding zero. */
  blockingCount: number;
}

export function computeScopeGapRollup(report: ScopeGapReport): ScopeGapRollup {
  const bySeverity: Record<ScopeGapSeverity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byCategory: Record<ScopeGapCategory, number> = {
    MISSING_LINE: 0,
    QUANTITY_LOW: 0,
    UNIT_WRONG: 0,
    INCIDENTAL_NOT_LINED: 0,
    SCOPE_AMBIGUOUS: 0,
    OTHER: 0,
  };
  let blockingCount = 0;
  for (const g of report.gaps) {
    bySeverity[g.severity] += 1;
    byCategory[g.category] += 1;
    if (g.severity === 'HIGH') blockingCount += 1;
  }
  return {
    total: report.gaps.length,
    bySeverity,
    byCategory,
    blockingCount,
  };
}

const SEVERITY_ORDER: Record<ScopeGapSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Sort gaps highest-severity first; stable within severity by
 *  category then specReference. */
export function sortGaps(gaps: ScopeGap[]): ScopeGap[] {
  return [...gaps].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (a.specReference ?? '').localeCompare(b.specReference ?? '');
  });
}
