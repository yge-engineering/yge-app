// Bid security — what goes in the envelope on bid day to guarantee the
// bid is real.
//
// California public works almost always require bid security:
//
//   - Bid bond (most common — surety issues a guarantee, no cash out of
//     pocket)
//   - Cashier's check (cash equivalent — ties up real money until award)
//   - Certified check (similar — ties up real money)
//
// The amount is set by the agency, almost always **10% of the total bid**.
// Some agencies bump it to 5% or even a fixed dollar amount; we let the
// user override the percent per estimate.
//
// Without bid security in the envelope on the day of the bid, the bid is
// non-responsive — the agency tosses it before the totals are even read.
//
// What this file does NOT cover (yet): performance bond and payment bond
// (each typically 100% of contract value). Those don't go in the bid
// envelope; the awarded contractor produces them between award and notice
// to proceed. The bonding command center in v6.2 tracks them separately.

import { z } from 'zod';
import type { Cents } from './money';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const BidSecurityTypeSchema = z.enum([
  'BID_BOND',
  'CASHIERS_CHECK',
  'CERTIFIED_CHECK',
  'OTHER',
]);
export type BidSecurityType = z.infer<typeof BidSecurityTypeSchema>;

export const BidSecuritySchema = z.object({
  /** What kind of security goes in the envelope. */
  type: BidSecurityTypeSchema,
  /** Decimal fraction of bid total. 0.10 = 10% — the common case in CA
   *  public works. Some agencies set 0.05 or a flat amount; the editor
   *  lets the estimator override. */
  percent: z.number().min(0).max(1).default(0.1),
  /** Surety company name. Required for BID_BOND, optional otherwise. */
  suretyName: z.string().max(200).optional(),
  /** Surety company address — printed on the bid form for some agencies. */
  suretyAddress: z.string().max(300).optional(),
  /** Bond number, if a bond. */
  bondNumber: z.string().max(60).optional(),
  /** Attorney-in-fact who signs on behalf of the surety. */
  attorneyInFact: z.string().max(200).optional(),
  /** Free-form notes — e.g. "Travelers — capacity confirmed via Brook on
   *  4/22". Internal only, not printed. */
  notes: z.string().max(1_000).optional(),
});
export type BidSecurity = z.infer<typeof BidSecuritySchema>;

/** Default starting state for a fresh estimate. 10% bid bond is the
 *  90%-of-the-time-correct answer for CA public works. */
export function defaultBidSecurity(): BidSecurity {
  return { type: 'BID_BOND', percent: 0.1 };
}

/**
 * Required dollar amount of bid security, in cents. Rounds to whole cents
 * (sureties round to whole dollars in practice, but the math stays
 * consistent with the rest of our money handling).
 */
export function bidSecurityAmountCents(
  bidTotalCents: Cents,
  security: BidSecurity,
): Cents {
  return Math.round(bidTotalCents * security.percent);
}

/** Human-readable label for the security type, for prints + UI labels. */
export function bidSecurityTypeLabel(t: BidSecurityType, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `bidSecurity.type.${t}`);
}
