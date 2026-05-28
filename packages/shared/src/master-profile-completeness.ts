// Master profile completeness scorecard.
//
// Plain English: walks the master business profile and reports
// what percent of each section is filled in. Drives the
// completeness card on /master-profile so Brook/Ryan can see
// "you're 70% done — fill in bonding + insurance to hit 100"
// without scrolling through the whole profile to count empties.
//
// Each section returns:
//   - label: human-readable section title
//   - key: stable identifier for routing / anchors
//   - filledCount: how many required-or-important fields are
//     non-empty
//   - requiredCount: total fields the section tracks
//   - percent: filledCount / requiredCount * 100 (0 when none)
//
// "filled" means a string of length > 0, a defined non-null
// value, or for arrays length > 0. We deliberately err on the
// side of "any value counts" rather than "must be specific
// shape" — the goal is to motivate completion, not nag.
//
// Scope: this helper is presentation-only. The Zod schema
// (./master-profile.ts) is the source of truth for what's
// actually valid at write time.
//
// Lives in shared so the same scorecard can light up on:
//   - /master-profile (full breakdown card)
//   - /go-live tile (one-line "you're at 73%")
//   - extension popup later if useful

import type { MasterProfile } from './master-profile';

export interface MasterProfileSectionScore {
  /** Stable identifier — used for anchor links + tests. */
  key:
    | 'identity'
    | 'address'
    | 'contact'
    | 'officers'
    | 'bonding'
    | 'insurance'
    | 'banking'
    | 'certifications';
  /** Human-readable section title for the UI. */
  label: string;
  /** Number of fields the section tracks. */
  requiredCount: number;
  /** Number of those fields that have a value. */
  filledCount: number;
  /** filledCount / requiredCount * 100, rounded to nearest int.
   *  Returns 0 when requiredCount is 0 (defensive). */
  percent: number;
}

export interface MasterProfileCompletenessReport {
  /** Per-section breakdown. Order matches typical "fill from top
   *  to bottom" flow on the editor page. */
  sections: MasterProfileSectionScore[];
  /** Sum of all sections' filledCount / sum of all sections'
   *  requiredCount, as an int percent. */
  overallPercent: number;
  /** Convenience: how many sections are at 100%. */
  completeSectionCount: number;
  /** Convenience: how many sections are at 0%. */
  emptySectionCount: number;
}

// ---- internal field-presence predicates ---------------------------------

function isFilledString(v: string | undefined | null): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function isFilledArray<T>(v: ReadonlyArray<T> | undefined | null): boolean {
  return Array.isArray(v) && v.length > 0;
}

// ---- per-section scorers -------------------------------------------------

function scoreIdentity(p: MasterProfile): MasterProfileSectionScore {
  // 8 identity fields. legalName/cslbLicense/dirNumber are required
  // by the schema (always present); the rest are optional but bid
  // forms commonly ask for them.
  const checks = [
    isFilledString(p.legalName),
    isFilledString(p.shortName),
    isFilledString(p.cslbLicense),
    isFilledArray(p.cslbClassifications),
    isFilledString(p.cslbExpiresOn),
    isFilledString(p.dirNumber),
    isFilledString(p.federalEin),
    isFilledString(p.dotNumber),
  ];
  return makeScore('identity', 'Identity + licenses', checks);
}

function scoreAddress(p: MasterProfile): MasterProfileSectionScore {
  // Primary address + optional mailing. Required core fields are
  // always present (Zod enforces); mailing + county are optional
  // but useful for ACORD certs + W-9.
  const checks = [
    isFilledString(p.address.street),
    isFilledString(p.address.city),
    isFilledString(p.address.state),
    isFilledString(p.address.zip),
    isFilledString(p.address.county),
    p.mailingAddress != null,
  ];
  return makeScore('address', 'Address', checks);
}

function scoreContact(p: MasterProfile): MasterProfileSectionScore {
  const checks = [
    isFilledString(p.primaryPhone),
    isFilledString(p.primaryEmail),
    isFilledString(p.websiteUrl),
    isFilledString(p.primaryFax),
  ];
  return makeScore('contact', 'Phone / email / web', checks);
}

function scoreOfficers(p: MasterProfile): MasterProfileSectionScore {
  // 1 point per officer up to 2 (president + VP at minimum),
  // 1 point if any officer has both phone + email, 1 point if
  // ownershipPercent is set somewhere (Brook/Ryan total = 100%).
  const officerCount = Math.min(p.officers.length, 2);
  const anyHasContact = p.officers.some(
    (o) => isFilledString(o.phone) && isFilledString(o.email),
  );
  const anyHasOwnership = p.officers.some((o) => o.ownershipPercent != null);
  const checks = [
    officerCount >= 1,
    officerCount >= 2,
    anyHasContact,
    anyHasOwnership,
  ];
  return makeScore('officers', 'Officers', checks);
}

function scoreBonding(p: MasterProfile): MasterProfileSectionScore {
  const b = p.bonding;
  const checks = [
    Boolean(b && isFilledString(b.suretyName)),
    Boolean(b && (b.singleJobLimitCents ?? 0) > 0),
    Boolean(b && (b.aggregateLimitCents ?? 0) > 0),
    Boolean(b && isFilledString(b.agentName)),
    Boolean(b && (isFilledString(b.agentPhone) || isFilledString(b.agentEmail))),
  ];
  return makeScore('bonding', 'Bonding', checks);
}

function scoreInsurance(p: MasterProfile): MasterProfileSectionScore {
  // Most agencies expect GL + Auto + WC at minimum.
  const hasKind = (kind: string): boolean =>
    p.insurance.some((pol) => pol.kind === kind);
  const checks = [
    hasKind('GENERAL_LIABILITY'),
    hasKind('AUTOMOBILE_LIABILITY'),
    hasKind('WORKERS_COMP'),
    hasKind('EXCESS_UMBRELLA'),
    p.insurance.length > 0 && p.insurance.every((pol) => isFilledString(pol.expiresOn)),
  ];
  return makeScore('insurance', 'Insurance', checks);
}

function scoreBanking(p: MasterProfile): MasterProfileSectionScore {
  const b = p.banking;
  const checks = [
    Boolean(b && isFilledString(b.bankName)),
    Boolean(b && isFilledString(b.routingNumber)),
    Boolean(b && isFilledString(b.contactName)),
  ];
  return makeScore('banking', 'Banking', checks);
}

function scoreCertifications(p: MasterProfile): MasterProfileSectionScore {
  // 1 point if NAICS populated, 1 for PSC, 1 for any diversity
  // status (DBE/SBE/DVBE/WBE) flagged true.
  const anyDiversity = p.isDbe || p.isSbe || p.isDvbe || p.isWbe;
  const checks = [
    isFilledArray(p.naicsCodes),
    isFilledArray(p.pscCodes),
    anyDiversity,
  ];
  return makeScore('certifications', 'Codes + certifications', checks);
}

// ---- internal --------------------------------------------------------------

function makeScore(
  key: MasterProfileSectionScore['key'],
  label: string,
  checks: ReadonlyArray<boolean>,
): MasterProfileSectionScore {
  const requiredCount = checks.length;
  const filledCount = checks.filter(Boolean).length;
  const percent =
    requiredCount === 0 ? 0 : Math.round((filledCount / requiredCount) * 100);
  return { key, label, requiredCount, filledCount, percent };
}

// ---- public --------------------------------------------------------------

/**
 * Compute the master profile completeness scorecard for the given
 * profile. Pure function — no I/O, safe to call on the server or
 * client. Returns sections in the canonical edit-page order.
 */
export function computeMasterProfileCompleteness(
  profile: MasterProfile,
): MasterProfileCompletenessReport {
  const sections: MasterProfileSectionScore[] = [
    scoreIdentity(profile),
    scoreAddress(profile),
    scoreContact(profile),
    scoreOfficers(profile),
    scoreBonding(profile),
    scoreInsurance(profile),
    scoreBanking(profile),
    scoreCertifications(profile),
  ];
  const totalRequired = sections.reduce((sum, s) => sum + s.requiredCount, 0);
  const totalFilled = sections.reduce((sum, s) => sum + s.filledCount, 0);
  const overallPercent =
    totalRequired === 0 ? 0 : Math.round((totalFilled / totalRequired) * 100);
  const completeSectionCount = sections.filter((s) => s.percent === 100).length;
  const emptySectionCount = sections.filter((s) => s.percent === 0).length;
  return { sections, overallPercent, completeSectionCount, emptySectionCount };
}
