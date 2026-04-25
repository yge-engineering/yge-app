// Addendum acknowledgment — every CA public-works RFP can be amended by
// addenda issued before bid open (drawing changes, spec clarifications,
// schedule extensions, sub-list changes, etc.). The bid form has a
// dedicated block where the prime *acknowledges* each addendum number.
// Missing one — even if the substance was incorporated — makes the bid
// non-responsive and gets it rejected at bid open.
//
// This module is the schema + helpers we use everywhere the estimate
// touches addenda: storage on PricedEstimate, the editor card on the
// estimate page, the acknowledgment block on the print bid summary.
//
// Storage shape is deliberately minimal: a flat list. The agency's
// numbering is authoritative — we accept whatever string they use
// ("1", "01", "Addendum No. 2", etc.) and don't enforce sequence.

import { z } from 'zod';

export const AddendumSchema = z.object({
  /** Stable per-row id used by the editor — generated client-side. */
  id: z.string().min(1).max(60),
  /** What the agency calls it. Verbatim — we don't normalize. */
  number: z.string().min(1).max(40),
  /** ISO date string (YYYY-MM-DD) when the agency issued it. Optional
   *  because agencies sometimes drop it without a date, and we'd rather
   *  let the estimator log the addendum than block on the missing field. */
  dateIssued: z.string().max(40).optional(),
  /** One-line "what changed" — the page count change, the new bid date,
   *  the spec section that got rewritten. Helps the bid reviewer at bid
   *  open verify we caught the right one. */
  subject: z.string().max(500).optional(),
  /** Has the estimator confirmed they read it and incorporated changes?
   *  This is the field that drives the "non-responsive" warning — an
   *  addendum logged but un-acknowledged is the dangerous state. */
  acknowledged: z.boolean(),
  /** Free-form internal notes (not printed on the bid form). */
  notes: z.string().max(1_000).optional(),
});
export type Addendum = z.infer<typeof AddendumSchema>;

// ---- Helpers -------------------------------------------------------------

/** Addenda the user has logged but not yet acknowledged. The print page
 *  + editor banner use this to nag before bid open. An empty list here
 *  means we're either fully acknowledged or no addenda exist. */
export function unacknowledgedAddenda(addenda: Addendum[]): Addendum[] {
  return addenda.filter((a) => !a.acknowledged);
}

/** True iff every logged addendum is acknowledged. Used by the print
 *  page to decide whether to show a green "all acknowledged" line vs
 *  a red "MISSING ACKNOWLEDGMENT" warning. */
export function allAddendaAcknowledged(addenda: Addendum[]): boolean {
  return addenda.every((a) => a.acknowledged);
}

/** Sort addenda for display. Numeric-aware so "Addendum 10" comes after
 *  "Addendum 2" instead of after "Addendum 1". Falls back to lexical
 *  order when both sides have a non-numeric prefix. */
export function sortedAddenda(addenda: Addendum[]): Addendum[] {
  return [...addenda].sort((a, b) => {
    const an = extractFirstNumber(a.number);
    const bn = extractFirstNumber(b.number);
    if (an != null && bn != null && an !== bn) return an - bn;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });
}

function extractFirstNumber(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}
