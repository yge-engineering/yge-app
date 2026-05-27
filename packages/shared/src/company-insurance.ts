// Company insurance profile.
//
// NOTE on overlap with master-profile.ts: this module's
// InsuranceProfile shape was added in bundle 2591; later I
// noticed `MasterProfileInsurancePolicySchema` in
// `./master-profile.ts` already covers the per-policy edit shape
// as an array (with 9 kinds: GL, Auto, WC, Excess Umbrella,
// Pollution, Professional, Equipment Floater, Builders Risk,
// Other). The two are intentionally separate now:
//
//   - master-profile.ts owns the BIG editable shape (DB-backed,
//     form-filler path resolution, broker fields per policy,
//     unbounded policy kinds)
//   - this module owns the SMALL read-only shape used by the
//     view-only /settings/company page + the expiry math
//     helpers (policyExpiryState, worstPolicySeverity,
//     combinedEachOccurrenceCents)
//
// When the DB-backed MasterProfile row is the source of truth,
// a small adapter will read from it and produce an
// InsuranceProfile for these helpers to consume.
//
// Coverage types tracked here: General Liability, Auto, Workers
// Comp, Umbrella — the four every ACORD 25 cert lists. Limits
// in cents per project convention.

import { z } from 'zod';

import type { Cents } from './money';

export const InsurancePolicySchema = z.object({
  /** Carrier name (e.g. "Travelers"). */
  carrier: z.string().min(1).max(120),
  /** Policy number — agencies often verify by digit, so don't
   *  truncate; allow a generous length. */
  policyNumber: z.string().min(1).max(60),
  /** Each-occurrence limit, cents. NULL for policies that don't
   *  have an each-occurrence concept (some umbrellas). */
  eachOccurrenceLimitCents: z.number().int().nonnegative().nullable().optional(),
  /** Aggregate limit, cents. */
  aggregateLimitCents: z.number().int().nonnegative().nullable().optional(),
  /** ISO date the policy expires. */
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Optional broker note (e.g. additional-insured endorsement
   *  status, special endorsement numbers). */
  brokerNote: z.string().max(500).optional(),
});

export type InsurancePolicy = z.infer<typeof InsurancePolicySchema>;

export const InsuranceProfileSchema = z.object({
  /** General Liability — required on every public-works job. */
  generalLiability: InsurancePolicySchema,
  /** Commercial Auto — required when YGE trucks roll. */
  commercialAuto: InsurancePolicySchema,
  /** Workers Comp — California requirement for any payroll. */
  workersComp: InsurancePolicySchema,
  /** Umbrella / Excess — recommended for any project > $1M. */
  umbrella: InsurancePolicySchema.optional(),
  /** Broker firm representing YGE (where the COI requests go). */
  brokerName: z.string().max(120).optional(),
  /** Broker contact (name + phone, free-form). */
  brokerContact: z.string().max(200).optional(),
});

export type InsuranceProfile = z.infer<typeof InsuranceProfileSchema>;

export interface PolicyExpiryState {
  /** Days from asOfDate until expiry. Negative when expired. */
  daysUntilExpiry: number;
  /** Severity bucket for UI tone. */
  severity: 'ok' | 'soon' | 'critical' | 'expired';
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Compute expiry state for a single policy. Severity bands:
 *  - expired: daysUntilExpiry < 0
 *  - critical: 0 <= days <= 14
 *  - soon: 15 <= days <= 45
 *  - ok: > 45 */
export function policyExpiryState(
  policy: InsurancePolicy,
  asOfDate: Date,
): PolicyExpiryState {
  const expiry = new Date(policy.expiryDate + 'T00:00:00Z');
  const days = Math.ceil((expiry.getTime() - asOfDate.getTime()) / MS_PER_DAY);
  let severity: PolicyExpiryState['severity'];
  if (days < 0) severity = 'expired';
  else if (days <= 14) severity = 'critical';
  else if (days <= 45) severity = 'soon';
  else severity = 'ok';
  return { daysUntilExpiry: days, severity };
}

/** Roll up expiry severity across the whole profile. Returns the
 *  worst severity found ('expired' beats 'critical' beats 'soon'
 *  beats 'ok'). Useful for the dashboard tile + master profile
 *  page badge. */
export function worstPolicySeverity(
  profile: InsuranceProfile,
  asOfDate: Date,
): PolicyExpiryState['severity'] {
  const policies: ReadonlyArray<InsurancePolicy> = [
    profile.generalLiability,
    profile.commercialAuto,
    profile.workersComp,
    ...(profile.umbrella ? [profile.umbrella] : []),
  ];
  const order: PolicyExpiryState['severity'][] = ['ok', 'soon', 'critical', 'expired'];
  let worstIdx = 0;
  for (const p of policies) {
    const idx = order.indexOf(policyExpiryState(p, asOfDate).severity);
    if (idx > worstIdx) worstIdx = idx;
  }
  return order[worstIdx] ?? 'ok';
}

/** Total per-occurrence coverage stacking GL + Umbrella, in
 *  cents. Used when an agency's bid spec lists a minimum
 *  combined coverage requirement. NULL when either side has
 *  no each-occurrence limit. */
export function combinedEachOccurrenceCents(
  profile: InsuranceProfile,
): Cents | null {
  const gl = profile.generalLiability.eachOccurrenceLimitCents;
  if (gl === undefined || gl === null) return null;
  if (!profile.umbrella) return gl;
  const um = profile.umbrella.eachOccurrenceLimitCents;
  if (um === undefined || um === null) return gl;
  return gl + um;
}
