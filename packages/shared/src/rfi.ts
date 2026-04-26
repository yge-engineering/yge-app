// RFI — Request For Information.
//
// On any active job, the prime asks the agency / engineer / architect for
// clarifications: "the spec calls for 6-inch base under the asphalt but
// the section detail says 8 — which is right?". The agency answers in
// writing and the answer becomes part of the contract.
//
// Phase 1 scope: per-job numbered RFIs, status pipeline DRAFT → SENT →
// ANSWERED → CLOSED, priority + cost/schedule impact flags, sent +
// answered dates. PDF attachment URL is a stub for the future doc-vault
// integration.
//
// What this catches that email alone doesn't:
//   - 'How many open RFIs on this job?'
//   - 'How long until that response comes back?'
//   - 'Did we ever close out RFI #14?'
//   - 'Did the engineer answer this in writing or just on a phone call?'

import { z } from 'zod';

export const RfiStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ANSWERED',
  'CLOSED',
  'WITHDRAWN',
]);
export type RfiStatus = z.infer<typeof RfiStatusSchema>;

export const RfiPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RfiPriority = z.infer<typeof RfiPrioritySchema>;

export const RfiSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** RFI number on the job. e.g. 14, RFI-014, etc. Free-form so each
   *  agency's preferred numbering scheme works. */
  rfiNumber: z.string().min(1).max(40),

  /** One-line subject. Always required. */
  subject: z.string().min(1).max(300),
  /** Full question text. Required for status >= SENT but allowed empty
   *  on drafts. */
  question: z.string().max(20_000).default(''),

  /** Who on YGE asked the question. Free-form Phase 1; FK to Employee
   *  Phase 4. */
  askedByEmployeeId: z.string().max(60).optional(),
  /** Who we sent the RFI to (engineer, architect, owner's rep). Free-form. */
  askedOf: z.string().max(200).optional(),

  /** Specific spec / plan references this RFI is about. Free-form
   *  ('Section 32 11 23, Sheet C-3 Note 14'). */
  referenceCitation: z.string().max(2_000).optional(),

  status: RfiStatusSchema.default('DRAFT'),
  priority: RfiPrioritySchema.default('MEDIUM'),

  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Date by which we need an answer to keep the schedule. */
  responseDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  answeredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** The agency's written answer. */
  answer: z.string().max(20_000).optional(),

  /** Does the answer change the price or schedule? Drives the change-
   *  order conversation. */
  costImpact: z.boolean().default(false),
  scheduleImpact: z.boolean().default(false),

  /** PDF / doc-vault URL of the RFI itself + the answer. */
  rfiPdfUrl: z.string().max(800).optional(),
  answerPdfUrl: z.string().max(800).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Rfi = z.infer<typeof RfiSchema>;

export const RfiCreateSchema = RfiSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: RfiStatusSchema.optional(),
  priority: RfiPrioritySchema.optional(),
  question: z.string().max(20_000).optional(),
  costImpact: z.boolean().optional(),
  scheduleImpact: z.boolean().optional(),
});
export type RfiCreate = z.infer<typeof RfiCreateSchema>;

export const RfiPatchSchema = RfiCreateSchema.partial();
export type RfiPatch = z.infer<typeof RfiPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function rfiStatusLabel(s: RfiStatus): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'SENT': return 'Sent';
    case 'ANSWERED': return 'Answered';
    case 'CLOSED': return 'Closed';
    case 'WITHDRAWN': return 'Withdrawn';
  }
}

export function rfiPriorityLabel(p: RfiPriority): string {
  switch (p) {
    case 'LOW': return 'Low';
    case 'MEDIUM': return 'Medium';
    case 'HIGH': return 'High';
    case 'CRITICAL': return 'Critical';
  }
}

/** Days the RFI has been outstanding. Negative when answer arrived
 *  before the response-due date. */
export function rfiDaysOutstanding(
  rfi: Pick<Rfi, 'sentAt' | 'answeredAt' | 'status'>,
  now: Date = new Date(),
): number | undefined {
  if (!rfi.sentAt) return undefined;
  const sent = new Date(rfi.sentAt + 'T00:00:00');
  if (Number.isNaN(sent.getTime())) return undefined;
  const end =
    rfi.answeredAt
      ? new Date(rfi.answeredAt + 'T23:59:59')
      : now;
  return Math.floor((end.getTime() - sent.getTime()) / (24 * 60 * 60 * 1000));
}

export type RfiUrgency = 'none' | 'ok' | 'dueSoon' | 'overdue' | 'answered';

export function rfiUrgency(
  rfi: Pick<Rfi, 'sentAt' | 'responseDueAt' | 'answeredAt' | 'status'>,
  now: Date = new Date(),
): RfiUrgency {
  if (rfi.answeredAt || rfi.status === 'ANSWERED' || rfi.status === 'CLOSED') {
    return 'answered';
  }
  if (!rfi.responseDueAt) return 'none';
  const due = new Date(rfi.responseDueAt + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return 'none';
  const deltaMs = due.getTime() - now.getTime();
  if (deltaMs < 0) return 'overdue';
  if (deltaMs < 3 * 24 * 60 * 60 * 1000) return 'dueSoon';
  return 'ok';
}

export interface RfiRollup {
  total: number;
  open: number;
  answered: number;
  withdrawn: number;
  overdue: number;
  /** Average days-to-answer over closed-out RFIs. NaN-safe. */
  averageResponseDays: number;
}

export function computeRfiRollup(rfis: Rfi[], now: Date = new Date()): RfiRollup {
  let open = 0;
  let answered = 0;
  let withdrawn = 0;
  let overdue = 0;
  const responseDays: number[] = [];
  for (const r of rfis) {
    if (r.status === 'WITHDRAWN') withdrawn += 1;
    else if (r.status === 'ANSWERED' || r.status === 'CLOSED') {
      answered += 1;
      const d = rfiDaysOutstanding(r);
      if (d !== undefined && d >= 0) responseDays.push(d);
    } else {
      open += 1;
      if (rfiUrgency(r, now) === 'overdue') overdue += 1;
    }
  }
  const averageResponseDays =
    responseDays.length > 0
      ? Math.round(
          (responseDays.reduce((a, b) => a + b, 0) / responseDays.length) * 10,
        ) / 10
      : 0;
  return { total: rfis.length, open, answered, withdrawn, overdue, averageResponseDays };
}

export function newRfiId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `rfi-${hex.padStart(8, '0')}`;
}
