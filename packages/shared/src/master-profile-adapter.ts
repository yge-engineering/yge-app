// Master profile adapters.
//
// The Phase-1 editable shape (MasterProfile in master-profile.ts)
// is the source of truth once the DB-backed form ships. The
// smaller read-only shapes in company-bonding.ts and
// company-insurance.ts power the view-only /settings/company
// page and the capacity / expiry math helpers.
//
// This module owns the bridge: take a MasterProfile (or its
// optional sub-fields) and produce the smaller shapes so the
// helpers run on real DB data without a refactor when the edit
// form lands.
//
// Adapters return null when the source data is missing — the
// helpers and UI already handle null gracefully.

import type { BondingProfile } from './company-bonding';
import type { InsuranceProfile, InsurancePolicy } from './company-insurance';
import type {
  MasterProfile,
  MasterProfileBonding,
  MasterProfileInsurancePolicy,
} from './master-profile';

/** Convert MasterProfileBonding → BondingProfile.
 *
 *  Field mapping:
 *    suretyName             → suretyName                   (1:1)
 *    agentName              → agentName                    (1:1)
 *    agentPhone+agentEmail  → agentContact (combined string)
 *    aggregateLimitCents    → aggregateCapacityCents       (renamed)
 *    singleJobLimitCents    → singleProjectCapacityCents   (renamed)
 *    -                      → currentBondedWorkOnHandCents (NOT on master;
 *                              caller supplies via woh param — typically
 *                              from /bond-capacity tracker)
 *    -                      → renewalDate (NOT on master; caller supplies
 *                              via renewalDate param)
 *    notes                  → (dropped — no slot in BondingProfile)
 *
 *  The two `caller supplies` fields (WOH + renewalDate) aren't on
 *  the editable master profile schema today. They live elsewhere
 *  (bond-capacity tracker for WOH, surety renewal calendar entry
 *  for the date). When the master-profile schema grows those
 *  fields, this signature simplifies.
 */
export function masterProfileToBondingProfile(
  source: MasterProfileBonding | undefined,
  extras: {
    currentBondedWorkOnHandCents: number;
    renewalDate: string;
  },
): BondingProfile | null {
  if (!source) return null;
  const agentContact = [source.agentPhone, source.agentEmail]
    .filter((s): s is string => Boolean(s && s.length > 0))
    .join(' · ');
  return {
    suretyName: source.suretyName,
    agentName: source.agentName,
    agentContact: agentContact.length > 0 ? agentContact : undefined,
    aggregateCapacityCents: source.aggregateLimitCents,
    singleProjectCapacityCents: source.singleJobLimitCents,
    currentBondedWorkOnHandCents: extras.currentBondedWorkOnHandCents,
    renewalDate: extras.renewalDate,
  };
}

/** Convert MasterProfile's insurance array (per-kind) into the
 *  InsuranceProfile shape with four named slots. Returns null when
 *  GL / Auto / WC are all missing — these three are required for
 *  an ACORD 25 to render meaningfully. Umbrella is optional.
 *
 *  When MasterProfile has multiple policies of the same kind
 *  (e.g. two GL policies covering different periods), the most
 *  recent expiry wins. That matches what an ACORD 25 wants —
 *  the "live" policy on any given day.
 */
export function masterProfileToInsuranceProfile(
  policies: ReadonlyArray<MasterProfileInsurancePolicy>,
): InsuranceProfile | null {
  const gl = pickLatestByKind(policies, 'GENERAL_LIABILITY');
  const auto = pickLatestByKind(policies, 'AUTOMOBILE_LIABILITY');
  const wc = pickLatestByKind(policies, 'WORKERS_COMP');
  if (!gl || !auto || !wc) return null;
  const umbrella = pickLatestByKind(policies, 'EXCESS_UMBRELLA');
  return {
    generalLiability: toInsurancePolicy(gl),
    commercialAuto: toInsurancePolicy(auto),
    workersComp: toInsurancePolicy(wc),
    umbrella: umbrella ? toInsurancePolicy(umbrella) : undefined,
  };
}

function pickLatestByKind(
  policies: ReadonlyArray<MasterProfileInsurancePolicy>,
  kind: MasterProfileInsurancePolicy['kind'],
): MasterProfileInsurancePolicy | undefined {
  const matching = policies.filter((p) => p.kind === kind);
  if (matching.length === 0) return undefined;
  // Sort descending by expiresOn — the one with the furthest-out
  // expiry is the live one. Stable sort isn't important.
  return [...matching].sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))[0];
}

function toInsurancePolicy(p: MasterProfileInsurancePolicy): InsurancePolicy {
  return {
    carrier: p.carrierName,
    policyNumber: p.policyNumber,
    eachOccurrenceLimitCents: p.perOccurrenceCents || null,
    aggregateLimitCents: p.aggregateCents || null,
    expiryDate: p.expiresOn,
    brokerNote:
      p.brokerName && p.brokerName.length > 0
        ? `Broker: ${p.brokerName}${p.brokerPhone ? ' · ' + p.brokerPhone : ''}`
        : undefined,
  };
}

/** Convenience: pull both bonding + insurance from a full
 *  MasterProfile row. Useful in pages that have the whole record
 *  and want both adapters in one call. */
export function masterProfileToReadOnlyShapes(
  profile: MasterProfile,
  bondingExtras: {
    currentBondedWorkOnHandCents: number;
    renewalDate: string;
  },
): {
  bonding: BondingProfile | null;
  insurance: InsuranceProfile | null;
} {
  return {
    bonding: masterProfileToBondingProfile(profile.bonding, bondingExtras),
    insurance: masterProfileToInsuranceProfile(profile.insurance ?? []),
  };
}
