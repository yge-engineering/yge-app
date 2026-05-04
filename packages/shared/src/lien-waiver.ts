// Lien waiver — CA Civil Code §8132/§8134/§8136/§8138 statutory forms.
//
// CA public + private construction work requires the four statutory
// waiver forms verbatim (with only company-specific blanks filled in).
// GCs and owners hold a progress payment until they have a waiver from
// every tier above the laborer/material level.
//
// The four forms are:
//   §8132 — Conditional waiver and release on PROGRESS payment
//   §8134 — Unconditional waiver and release on PROGRESS payment
//   §8136 — Conditional waiver and release on FINAL payment
//   §8138 — Unconditional waiver and release on FINAL payment
//
// "Conditional" = effective only when the check actually clears.
// "Unconditional" = effective immediately on signing; the lien rights
// are released even if the check bounces. Sign unconditional waivers
// only after the funds clear.
//
// Phase 1 stores the waiver record + the data needed to print the
// statutory form. The form text itself is rendered by the print page
// from the latest CA statute language.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const LienWaiverKindSchema = z.enum([
  'CONDITIONAL_PROGRESS',   // §8132
  'UNCONDITIONAL_PROGRESS', // §8134
  'CONDITIONAL_FINAL',      // §8136
  'UNCONDITIONAL_FINAL',    // §8138
]);
export type LienWaiverKind = z.infer<typeof LienWaiverKindSchema>;

export const LienWaiverStatusSchema = z.enum([
  'DRAFT',
  'SIGNED',
  'DELIVERED',
  'VOIDED',
]);
export type LienWaiverStatus = z.infer<typeof LienWaiverStatusSchema>;

export const LienWaiverSchema = z.object({
  /** Stable id `lw-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Optional link to the AR invoice this waiver covers. */
  arInvoiceId: z.string().max(120).optional(),
  /** Optional link to the AR payment that triggered the waiver. */
  arPaymentId: z.string().max(120).optional(),

  kind: LienWaiverKindSchema,
  status: LienWaiverStatusSchema.default('DRAFT'),

  // ---- Header data printed on the form ---------------------------------

  /** Owner / Customer that the waiver runs to. */
  ownerName: z.string().min(1).max(200),
  /** Job / property name (CA wants a "name of property" field). */
  jobName: z.string().min(1).max(200),
  /** Property location / address. */
  jobAddress: z.string().max(400).optional(),

  /** Claimant — should be YGE for our waivers. */
  claimantName: z.string().min(1).max(200),

  // ---- Money + dates ---------------------------------------------------

  /** PROGRESS waivers: amount of THIS progress payment.
   *  FINAL waivers: total final amount. (cents) */
  paymentAmountCents: z.number().int().nonnegative(),
  /** Through-date — last date of work covered by this waiver. (yyyy-mm-dd) */
  throughDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  /** PROGRESS waivers: any disputed retention or extras NOT being
   *  released. The statutory form has a place for these. (cents) */
  disputedAmountCents: z.number().int().nonnegative().optional(),
  /** PROGRESS waivers: short list of disputed items (free-form). */
  disputedItems: z.string().max(2_000).optional(),

  // ---- Signing ---------------------------------------------------------

  /** Date the form was actually signed. (yyyy-mm-dd) */
  signedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Name of person who signed. */
  signedByName: z.string().max(120).optional(),
  /** Title of person who signed. */
  signedByTitle: z.string().max(80).optional(),
  /** Date delivered to the GC / owner. (yyyy-mm-dd) */
  deliveredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  notes: z.string().max(10_000).optional(),
});
export type LienWaiver = z.infer<typeof LienWaiverSchema>;

export const LienWaiverCreateSchema = LienWaiverSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: LienWaiverStatusSchema.optional(),
});
export type LienWaiverCreate = z.infer<typeof LienWaiverCreateSchema>;

export const LienWaiverPatchSchema = LienWaiverCreateSchema.partial();
export type LienWaiverPatch = z.infer<typeof LienWaiverPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function lienWaiverKindLabel(k: LienWaiverKind, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `lienWaiver.kind.${k}`);
}

export function lienWaiverShortKindLabel(k: LienWaiverKind, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `lienWaiver.shortKind.${k}`);
}

export function lienWaiverStatuteLabel(k: LienWaiverKind): string {
  switch (k) {
    case 'CONDITIONAL_PROGRESS': return '§8132';
    case 'UNCONDITIONAL_PROGRESS': return '§8134';
    case 'CONDITIONAL_FINAL': return '§8136';
    case 'UNCONDITIONAL_FINAL': return '§8138';
  }
}

export function lienWaiverStatusLabel(s: LienWaiverStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `lienWaiver.status.${s}`);
}

/** True iff the waiver is one of the conditional forms. Conditional
 *  forms are effective only when the check clears, so they're safe to
 *  hand over BEFORE the check has cleared. Unconditional forms must NEVER
 *  be signed before the funds have cleared. */
export function isConditional(k: LienWaiverKind): boolean {
  return k === 'CONDITIONAL_PROGRESS' || k === 'CONDITIONAL_FINAL';
}

/** True iff the waiver is on the FINAL payment. */
export function isFinal(k: LienWaiverKind): boolean {
  return k === 'CONDITIONAL_FINAL' || k === 'UNCONDITIONAL_FINAL';
}

export interface LienWaiverRollup {
  total: number;
  draft: number;
  signed: number;
  delivered: number;
  /** Count by waiver kind. */
  byKind: Array<{ kind: LienWaiverKind; count: number }>;
  /** Count of unconditional waivers in DRAFT — these are a safety
   *  concern (don't sign uncond. before money clears). */
  unsignedUnconditional: number;
}

export function computeLienWaiverRollup(waivers: LienWaiver[]): LienWaiverRollup {
  let draft = 0;
  let signed = 0;
  let delivered = 0;
  let unsignedUnconditional = 0;
  const byKindMap = new Map<LienWaiverKind, number>();
  for (const w of waivers) {
    if (w.status === 'DRAFT') draft += 1;
    else if (w.status === 'SIGNED') signed += 1;
    else if (w.status === 'DELIVERED') delivered += 1;
    if (
      w.status === 'DRAFT' &&
      (w.kind === 'UNCONDITIONAL_PROGRESS' || w.kind === 'UNCONDITIONAL_FINAL')
    ) {
      unsignedUnconditional += 1;
    }
    byKindMap.set(w.kind, (byKindMap.get(w.kind) ?? 0) + 1);
  }
  return {
    total: waivers.length,
    draft,
    signed,
    delivered,
    byKind: Array.from(byKindMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    unsignedUnconditional,
  };
}

export function newLienWaiverId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `lw-${hex.padStart(8, '0')}`;
}
