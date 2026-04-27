// Punch list — closeout walkthrough item.
//
// Substantial completion walkthrough generates a list of items that
// have to be fixed before the job can be closed out (and final
// payment + retention released). Each item lives at a specific
// location in the work, has a responsible party, a status, and a
// due date.

import { z } from 'zod';

export const PunchItemStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'DISPUTED',
  'WAIVED',
]);
export type PunchItemStatus = z.infer<typeof PunchItemStatusSchema>;

export const PunchItemSeveritySchema = z.enum([
  'SAFETY',     // safety-critical — blocks payment + walkthrough
  'MAJOR',      // contractually required — blocks final payment
  'MINOR',      // cosmetic / nuisance
]);
export type PunchItemSeverity = z.infer<typeof PunchItemSeveritySchema>;

export const PunchItemSchema = z.object({
  /** Stable id `pi-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),

  /** Walkthrough date item was identified (yyyy-mm-dd). */
  identifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Free-form location ("Sta. 12+50 LT", "Catch basin #3"). */
  location: z.string().min(1).max(200),
  /** Description of the deficiency. */
  description: z.string().min(1).max(2_000),

  severity: PunchItemSeveritySchema.default('MINOR'),
  status: PunchItemStatusSchema.default('OPEN'),

  /** Who's on the hook to fix it. Free-form name (could be sub or
   *  in-house crew). */
  responsibleParty: z.string().max(120).optional(),
  /** Optional vendor id when the responsible party is a sub. */
  responsibleVendorId: z.string().max(120).optional(),

  /** Target completion date (yyyy-mm-dd). */
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Date item was marked closed (yyyy-mm-dd). */
  closedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Initials of person who verified the fix. */
  closedByInitials: z.string().max(10).optional(),

  /** Photo / attachment refs (free-form for now). */
  photoRefs: z.array(z.string().max(400)).optional(),
  /** Free-form notes. */
  notes: z.string().max(10_000).optional(),
});
export type PunchItem = z.infer<typeof PunchItemSchema>;

export const PunchItemCreateSchema = PunchItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  severity: PunchItemSeveritySchema.optional(),
  status: PunchItemStatusSchema.optional(),
});
export type PunchItemCreate = z.infer<typeof PunchItemCreateSchema>;

export const PunchItemPatchSchema = PunchItemCreateSchema.partial();
export type PunchItemPatch = z.infer<typeof PunchItemPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function punchItemStatusLabel(s: PunchItemStatus): string {
  switch (s) {
    case 'OPEN': return 'Open';
    case 'IN_PROGRESS': return 'In progress';
    case 'CLOSED': return 'Closed';
    case 'DISPUTED': return 'Disputed';
    case 'WAIVED': return 'Waived';
  }
}

export function punchItemSeverityLabel(s: PunchItemSeverity): string {
  switch (s) {
    case 'SAFETY': return 'Safety';
    case 'MAJOR': return 'Major';
    case 'MINOR': return 'Minor';
  }
}

/** True iff the item is still blocking closeout (not closed or waived). */
export function isOpenForCloseout(item: PunchItem): boolean {
  return item.status !== 'CLOSED' && item.status !== 'WAIVED';
}

/** True iff item is overdue (has a due date in the past + still open). */
export function isOverdue(
  item: PunchItem,
  now: Date = new Date(),
): boolean {
  if (!isOpenForCloseout(item)) return false;
  if (!item.dueOn) return false;
  const due = new Date(item.dueOn + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export interface PunchListRollup {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  disputed: number;
  /** Open items with severity=SAFETY. */
  openSafety: number;
  /** Open items past their due date. */
  overdue: number;
  /** True iff the job has zero open major-or-safety items — ready for
   *  final payment release. */
  readyForCloseout: boolean;
}

export function computePunchListRollup(
  items: PunchItem[],
  now: Date = new Date(),
): PunchListRollup {
  let open = 0;
  let inProgress = 0;
  let closed = 0;
  let disputed = 0;
  let openSafety = 0;
  let overdue = 0;
  let openMajorOrSafety = 0;
  for (const it of items) {
    if (it.status === 'OPEN') open += 1;
    else if (it.status === 'IN_PROGRESS') inProgress += 1;
    else if (it.status === 'CLOSED') closed += 1;
    else if (it.status === 'DISPUTED') disputed += 1;
    if (isOpenForCloseout(it)) {
      if (it.severity === 'SAFETY') {
        openSafety += 1;
        openMajorOrSafety += 1;
      } else if (it.severity === 'MAJOR') {
        openMajorOrSafety += 1;
      }
    }
    if (isOverdue(it, now)) overdue += 1;
  }
  return {
    total: items.length,
    open,
    inProgress,
    closed,
    disputed,
    openSafety,
    overdue,
    readyForCloseout: items.length > 0 && openMajorOrSafety === 0,
  };
}

export function newPunchItemId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pi-${hex.padStart(8, '0')}`;
}
