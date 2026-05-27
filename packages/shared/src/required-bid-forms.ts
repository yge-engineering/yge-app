// Required-bid-forms map.
//
// For any given owner agency, returns the set of standard
// compliance forms YGE has to file with the bid. Designed for
// the bid-day envelope checklist + the /pdf-forms library: when
// Ryan is bidding a Caltrans job, the system should highlight
// the 8 forms required for Caltrans federal-aid contracts (vs
// the 4 required for a Shasta County job).
//
// Returns mapping IDs that match `pdf-form-mappings-seeds.ts`
// so the UI can deep-link straight into each form.

/** Logical agency type — derived from the estimate's
 *  ownerAgency string (e.g. "Caltrans", "Shasta County",
 *  "City of Anderson", "CAL FIRE"). */
export type RequiredFormsAgencyType =
  | 'CALTRANS_FEDERAL_AID'
  | 'CALTRANS_STATE_ONLY'
  | 'CAL_FIRE'
  | 'COUNTY_SHASTA'
  | 'COUNTY_TEHAMA'
  | 'COUNTY_GLENN'
  | 'COUNTY_LASSEN'
  | 'COUNTY_SISKIYOU'
  | 'COUNTY_MODOC'
  | 'COUNTY_BUTTE'
  | 'COUNTY_OTHER'
  | 'CITY'
  | 'FEDERAL_DIRECT'
  | 'UNKNOWN';

export interface RequiredFormRef {
  /** Stable mapping id from pdf-form-mappings-seeds.ts. */
  mappingId: string;
  /** Plain-English form name as displayed in the UI. */
  label: string;
  /** Why this form is required for this agency. */
  why: string;
  /** When true, the form is ALWAYS required. When false, it's
   *  only required above a threshold (e.g. ICA cert > $1M).
   *  UI may show conditional forms in a separate section. */
  alwaysRequired: boolean;
}

/** Forms required on every CA public-works bid regardless of
 *  agency. Used as the base set; specific agencies layer on
 *  additional forms (or upgrade conditionals to required). */
const CA_PUBLIC_WORKS_BASE: RequiredFormRef[] = [
  {
    mappingId: 'pdf-form-ca-non-collusion-affidavit',
    label: 'Non-Collusion Affidavit (PCC §7106)',
    why: 'PCC §7106 — required on every public-works bid in CA.',
    alwaysRequired: true,
  },
  {
    mappingId: 'pdf-form-ca-workers-comp-affidavit',
    label: 'Workers Comp Cert (Labor Code §1861)',
    why: 'Labor Code §1861 — required on every CA public-works contract.',
    alwaysRequired: true,
  },
  {
    mappingId: 'pdf-form-ca-drug-free-workplace',
    label: 'Drug-Free Workplace Cert (Gov Code §8350)',
    why: 'Required on every CA state agency contract or grant.',
    alwaysRequired: true,
  },
  {
    mappingId: 'pdf-form-ca-iran-contracting-act',
    label: 'Iran Contracting Act Cert (PCC §2204)',
    why: 'Required when bid total exceeds $1,000,000.',
    alwaysRequired: false,
  },
  {
    mappingId: 'pdf-form-calrecycle-recycled-content',
    label: 'CalRecycle Recycled-Content Cert (PCC §12200)',
    why: 'PCC §12200 — every CA state contract requires this on file.',
    alwaysRequired: true,
  },
];

/** Insurance evidence required on most bids. */
const ACORD_INSURANCE_PACK: RequiredFormRef[] = [
  {
    mappingId: 'pdf-form-acord-25',
    label: 'ACORD 25 — Certificate of Liability Insurance',
    why: 'Standard agency requirement; covers GL + Auto + WC + Umbrella.',
    alwaysRequired: true,
  },
];

/** Federal-aid highway contracts (most Caltrans, some county
 *  federal-aid routes). */
const FEDERAL_AID_PACK: RequiredFormRef[] = [
  {
    mappingId: 'pdf-form-fhwa-1273',
    label: 'FHWA-1273 — Federal-Aid Required Contract Provisions',
    why: 'Mandatory attachment on every federally-funded highway contract.',
    alwaysRequired: true,
  },
];

/** County-specific bidder affidavit lookup keyed by slug. */
const COUNTY_AFFIDAVIT_BY_SLUG: Record<string, RequiredFormRef> = {
  shasta: {
    mappingId: 'pdf-form-shasta-county-bidder-affidavit',
    label: 'Shasta County Bidder Affidavit',
    why: 'Shasta County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  tehama: {
    mappingId: 'pdf-form-tehama-county-bidder-affidavit',
    label: 'Tehama County Bidder Affidavit',
    why: 'Tehama County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  glenn: {
    mappingId: 'pdf-form-glenn-county-bidder-affidavit',
    label: 'Glenn County Bidder Affidavit',
    why: 'Glenn County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  lassen: {
    mappingId: 'pdf-form-lassen-county-bidder-affidavit',
    label: 'Lassen County Bidder Affidavit',
    why: 'Lassen County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  siskiyou: {
    mappingId: 'pdf-form-siskiyou-county-bidder-affidavit',
    label: 'Siskiyou County Bidder Affidavit',
    why: 'Siskiyou County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  modoc: {
    mappingId: 'pdf-form-modoc-county-bidder-affidavit',
    label: 'Modoc County Bidder Affidavit',
    why: 'Modoc County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
  butte: {
    mappingId: 'pdf-form-butte-county-bidder-affidavit',
    label: 'Butte County Bidder Affidavit',
    why: 'Butte County standard bidder identity + debarment + bid bond enclosed affidavit.',
    alwaysRequired: true,
  },
};

/** PW-specific forms required for any public works contract
 *  with payroll over the apprentice threshold. */
const PW_APPRENTICE_PACK: RequiredFormRef[] = [
  {
    mappingId: 'pdf-form-dir-das-140',
    label: 'DAS-140 — Public Works Contract Award',
    why: 'Filed within 10 days of award on every PW job over the apprentice threshold.',
    alwaysRequired: true,
  },
  {
    mappingId: 'pdf-form-dir-pwc-100',
    label: 'PWC-100 — Public Works Project Award Notice',
    why: 'Filed with DIR within 5 days of award.',
    alwaysRequired: true,
  },
];

/** Heuristic: classify an ownerAgency string into a logical
 *  agency type. Loose substring match; the UI can override. */
export function classifyAgencyType(
  ownerAgency: string | undefined,
  bidTotalCents?: number,
): RequiredFormsAgencyType {
  const s = (ownerAgency ?? '').toLowerCase();
  if (s.length === 0) return 'UNKNOWN';
  if (s.includes('caltrans')) {
    // Caltrans projects often have federal aid; treat as
    // federal-aid by default. Caller can downgrade.
    return 'CALTRANS_FEDERAL_AID';
  }
  if (s.includes('cal fire') || s.includes('calfire')) return 'CAL_FIRE';
  if (s.includes('shasta')) return 'COUNTY_SHASTA';
  if (s.includes('tehama')) return 'COUNTY_TEHAMA';
  if (s.includes('glenn')) return 'COUNTY_GLENN';
  if (s.includes('lassen')) return 'COUNTY_LASSEN';
  if (s.includes('siskiyou')) return 'COUNTY_SISKIYOU';
  if (s.includes('modoc')) return 'COUNTY_MODOC';
  if (s.includes('butte')) return 'COUNTY_BUTTE';
  if (s.includes('county')) return 'COUNTY_OTHER';
  if (
    s.includes('city of') ||
    s.includes('town of') ||
    s.includes('redding') ||
    s.includes('anderson') ||
    s.includes('cottonwood')
  ) {
    return 'CITY';
  }
  if (s.includes('federal') || s.includes('usda') || s.includes('blm')) {
    return 'FEDERAL_DIRECT';
  }
  // Bid-total fallback isn't used yet but the signature
  // accepts it so callers can pass it in for future tweaks.
  void bidTotalCents;
  return 'UNKNOWN';
}

/** Return the recommended required-form set for the given
 *  agency type + bid total. */
export function requiredBidFormsFor(
  agencyType: RequiredFormsAgencyType,
  bidTotalCents?: number,
): RequiredFormRef[] {
  const isOverMillion = (bidTotalCents ?? 0) > 1_000_000_00;
  // Promote ICA to always-required when over $1M.
  const base = CA_PUBLIC_WORKS_BASE.map((f) =>
    f.mappingId === 'pdf-form-ca-iran-contracting-act'
      ? { ...f, alwaysRequired: f.alwaysRequired || isOverMillion }
      : f,
  );

  switch (agencyType) {
    case 'CALTRANS_FEDERAL_AID':
      return [...base, ...ACORD_INSURANCE_PACK, ...FEDERAL_AID_PACK, ...PW_APPRENTICE_PACK];
    case 'CALTRANS_STATE_ONLY':
      return [...base, ...ACORD_INSURANCE_PACK, ...PW_APPRENTICE_PACK];
    case 'CAL_FIRE':
      return [...base, ...ACORD_INSURANCE_PACK];
    case 'COUNTY_SHASTA':
    case 'COUNTY_TEHAMA':
    case 'COUNTY_GLENN':
    case 'COUNTY_LASSEN':
    case 'COUNTY_SISKIYOU':
    case 'COUNTY_MODOC':
    case 'COUNTY_BUTTE': {
      const slug = agencyType.replace('COUNTY_', '').toLowerCase();
      const countyForm = COUNTY_AFFIDAVIT_BY_SLUG[slug];
      const out = [...base, ...ACORD_INSURANCE_PACK];
      if (countyForm) out.push(countyForm);
      return out;
    }
    case 'COUNTY_OTHER':
    case 'CITY':
      return [...base, ...ACORD_INSURANCE_PACK];
    case 'FEDERAL_DIRECT':
      return [...base, ...ACORD_INSURANCE_PACK, ...FEDERAL_AID_PACK];
    case 'UNKNOWN':
      return [...base, ...ACORD_INSURANCE_PACK];
  }
}
