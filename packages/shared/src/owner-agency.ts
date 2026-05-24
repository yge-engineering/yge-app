// Owner-agency classifier.
//
// Given an owner name + optional document text + optional funding hints,
// returns what kind of public/private body is letting the project and the
// compliance posture that follows. Used upstream by:
//
//   - the Plans-to-Estimate UI to default sensible flags before the user
//     opens the estimate (e.g. prevailing wage on by default for Caltrans);
//   - the deadline calendar to know whether to surface DAS-140 / Davis-Bacon
//     / county-specific deadlines;
//   - the bid-no-bid coach to know what bonding / insurance limits apply.
//
// Pure heuristic — no AI call, no I/O. The match runs in O(N) over the
// inputs against a small set of agency keyword bundles. The result is
// always a useful default, never a hard claim — the human estimator can
// override the classification (and overall the system should let them, per
// CLAUDE.md "Default is AI drafts, human approves").

/** Top-level agency category. UNCLASSIFIED means the heuristic found
 *  nothing convincing and the human needs to pick. */
export type OwnerAgencyKind =
  | 'CALTRANS'
  | 'COUNTY'
  | 'MUNICIPAL'
  | 'MUNICIPAL_UTILITY'
  | 'CAL_FIRE'
  | 'STATE_PARKS'
  | 'FEDERAL_FOREST_SERVICE'
  | 'FEDERAL_BLM'
  | 'FEDERAL_BIA'
  | 'FEDERAL_OTHER'
  | 'PRIVATE'
  | 'UNCLASSIFIED';

/** Compliance flags that follow from the agency classification.
 *
 *  None of these are absolute — every project gets reviewed by Brook
 *  before submission — but they're the right starting defaults that get
 *  the estimator 80% of the way there. */
export interface OwnerAgencyCompliance {
  /** California prevailing wage applies (state, federal, or DIR-covered
   *  contract). True for every CA public-works job above $1,000 except a
   *  few narrow exemptions. */
  prevailingWage: boolean;
  /** Federal Davis-Bacon wages apply on top of (or instead of) CA PW.
   *  True when the project pulls federal money — Forest Service, BLM,
   *  BIA, FHWA / federal-aid Caltrans. */
  davisBacon: boolean;
  /** DAS-140 "Public Works Contract Award" must be filed with DIR
   *  within 5 days of award. True for any CA public-works job that hits
   *  the threshold, plus federally-funded jobs that flow through
   *  Caltrans. */
  das140Required: boolean;
  /** §4104 designated-subcontractor listing on the bid form required.
   *  CA Public Contracts Code §4100-4114 — applies to every public-works
   *  prime bid in California. False for private work. */
  subListingRequired: boolean;
  /** CWA / NPDES storm-water permit + SWPPP required by the owner.
   *  Always true for Caltrans + most state-funded earthwork projects
   *  over 1 acre disturbed. */
  swpppLikely: boolean;
}

export interface OwnerAgencyClassification {
  kind: OwnerAgencyKind;
  /** Score (0–1) showing how confident the heuristic is. 0.9+ when a
   *  high-signal token matched (e.g. "Caltrans"); 0.5–0.7 when only a
   *  weak signal matched; 0.0 when nothing matched and `kind` is
   *  UNCLASSIFIED. The UI can show a "Verify agency" prompt when the
   *  score is < 0.7. */
  confidence: number;
  /** Up to three short strings explaining what fired the classification —
   *  useful for the "why did the AI think this?" tooltip. */
  matchedSignals: string[];
  compliance: OwnerAgencyCompliance;
}

/** Inputs to the classifier. All optional — the function does the best
 *  it can with whatever the caller has. */
export interface OwnerAgencyInput {
  /** Owner name as it appears on the bid form / RFP cover (e.g.
   *  "California Department of Transportation", "Shasta County DPW"). */
  ownerName?: string;
  /** Free-form document text — the Plans-to-Estimate extractor passes
   *  the full RFP body here. The matcher only scans the first 8KB to
   *  keep things cheap; high-signal tokens live in the title block. */
  documentText?: string;
  /** Funding source if the caller already knows it (e.g.
   *  'CALFIRE_GRANT', 'FEMA', 'FHWA'). Skips heuristic and forces the
   *  matching classification. */
  fundingSource?: string;
}

/** Internal: per-kind signal bundle. Order matters — higher-priority
 *  bundles are checked first so that a "Caltrans / Shasta County
 *  partnership" packet gets tagged CALTRANS, not COUNTY. */
interface SignalBundle {
  kind: OwnerAgencyKind;
  /** When any of these substrings appear in owner/doc text, score the
   *  bundle as a HIGH-confidence match (0.95). */
  strong: string[];
  /** When any of these appear (and no strong match exists), score as
   *  WEAK (0.55). */
  weak?: string[];
  compliance: OwnerAgencyCompliance;
}

// Highest-priority bundles first.
const SIGNALS: SignalBundle[] = [
  {
    kind: 'CALTRANS',
    strong: [
      'caltrans',
      'california department of transportation',
      'state of california department of transportation',
      'district 1 caltrans',
      'district 2 caltrans',
      'district 3 caltrans',
      'd2 caltrans',
    ],
    weak: ['state highway', 'shs'],
    compliance: {
      prevailingWage: true,
      davisBacon: false, // depends on federal-aid; flagged separately
      das140Required: true,
      subListingRequired: true,
      swpppLikely: true,
    },
  },
  {
    kind: 'CAL_FIRE',
    strong: [
      'cal fire',
      'cal-fire',
      'calfire',
      'california department of forestry',
      'cdf',
    ],
    weak: ['fuel reduction', 'vegetation management contract'],
    compliance: {
      prevailingWage: true,
      davisBacon: false,
      das140Required: true,
      subListingRequired: true,
      swpppLikely: false,
    },
  },
  {
    kind: 'STATE_PARKS',
    strong: [
      'california state parks',
      'state parks department',
      'state park',
    ],
    compliance: {
      prevailingWage: true,
      davisBacon: false,
      das140Required: true,
      subListingRequired: true,
      swpppLikely: true,
    },
  },
  {
    kind: 'FEDERAL_FOREST_SERVICE',
    strong: [
      'us forest service',
      'usda forest service',
      'forest service',
      'usfs',
      'shasta-trinity national forest',
      'lassen national forest',
      'mendocino national forest',
    ],
    compliance: {
      prevailingWage: true,
      davisBacon: true,
      das140Required: false, // federal direct — federal wage decisions instead
      subListingRequired: false, // CA §4104 doesn't apply to federal direct
      swpppLikely: true,
    },
  },
  {
    kind: 'FEDERAL_BLM',
    strong: ['bureau of land management', 'blm'],
    compliance: {
      prevailingWage: true,
      davisBacon: true,
      das140Required: false,
      subListingRequired: false,
      swpppLikely: true,
    },
  },
  {
    kind: 'FEDERAL_BIA',
    strong: [
      'bureau of indian affairs',
      'bia',
      'tribal council',
      'tribal contract',
    ],
    compliance: {
      prevailingWage: true,
      davisBacon: true,
      das140Required: false,
      subListingRequired: false,
      swpppLikely: true,
    },
  },
  {
    kind: 'FEDERAL_OTHER',
    strong: [
      'federal highway administration',
      'fhwa',
      'us army corps of engineers',
      'usace',
      'fema',
      'department of homeland security',
      'national park service',
      'nps',
    ],
    compliance: {
      prevailingWage: true,
      davisBacon: true,
      das140Required: false,
      subListingRequired: false,
      swpppLikely: true,
    },
  },
  {
    kind: 'MUNICIPAL_UTILITY',
    strong: [
      'pud',
      'public utility district',
      'water district',
      'irrigation district',
      'sewer district',
      'redding electric utility',
      'pacific gas and electric',
      'pg&e',
    ],
    weak: ['utility easement'],
    compliance: {
      prevailingWage: true,
      davisBacon: false,
      das140Required: true,
      subListingRequired: true,
      swpppLikely: true,
    },
  },
  {
    kind: 'COUNTY',
    strong: [
      'shasta county',
      'tehama county',
      'trinity county',
      'siskiyou county',
      'butte county',
      'glenn county',
      'lassen county',
      'county of shasta',
      'county of tehama',
      'county department of public works',
      'county dpw',
    ],
    weak: ['county road', 'county engineer'],
    compliance: {
      prevailingWage: true,
      davisBacon: false,
      das140Required: true,
      subListingRequired: true,
      swpppLikely: true,
    },
  },
  {
    kind: 'MUNICIPAL',
    strong: [
      'city of redding',
      'city of anderson',
      'city of red bluff',
      'city of corning',
      'city of chico',
      'city of yuba city',
      'city engineer',
      'city of ',
    ],
    weak: ['municipal'],
    compliance: {
      prevailingWage: true,
      davisBacon: false,
      das140Required: true,
      subListingRequired: true,
      swpppLikely: true,
    },
  },
];

const PRIVATE_COMPLIANCE: OwnerAgencyCompliance = {
  prevailingWage: false,
  davisBacon: false,
  das140Required: false,
  subListingRequired: false,
  swpppLikely: false, // depends on disturbed acreage — flag at the site level
};

const PRIVATE_TOKENS = [
  'private owner',
  'developer',
  'lp ',
  ' llc',
  'commercial development',
  'industrial',
  'homeowners association',
  ' hoa',
];

/** Classify the owning agency.
 *
 *  Algorithm:
 *    1. If fundingSource explicitly forces a kind, use that.
 *    2. Otherwise scan owner name + first 8KB of document text in
 *       lowercase against each SignalBundle in declared order. Highest
 *       single match wins.
 *    3. If nothing matched but at least one PRIVATE_TOKEN fired, return
 *       PRIVATE with weak confidence.
 *    4. Otherwise return UNCLASSIFIED so the UI prompts the human.
 */
export function classifyOwnerAgency(
  input: OwnerAgencyInput,
): OwnerAgencyClassification {
  const owner = (input.ownerName ?? '').toLowerCase();
  const doc = (input.documentText ?? '').slice(0, 8 * 1024).toLowerCase();
  const haystack = `${owner}\n${doc}`;

  // 1. Explicit funding-source override.
  if (input.fundingSource) {
    const forced = forceKindForFundingSource(input.fundingSource);
    if (forced) {
      return {
        kind: forced.kind,
        confidence: 1.0,
        matchedSignals: [`fundingSource=${input.fundingSource}`],
        compliance: forced.compliance,
      };
    }
  }

  // 2. Signal bundles.
  let best: { bundle: SignalBundle; signals: string[]; score: number } | null =
    null;
  for (const bundle of SIGNALS) {
    const strongHits = bundle.strong.filter((s) => haystack.includes(s));
    const weakHits = (bundle.weak ?? []).filter((s) => haystack.includes(s));
    if (strongHits.length === 0 && weakHits.length === 0) continue;
    const score = strongHits.length > 0 ? 0.95 : 0.55;
    const signals = strongHits.length > 0 ? strongHits : weakHits;
    if (!best || score > best.score) {
      best = { bundle, signals: signals.slice(0, 3), score };
    }
  }
  if (best) {
    return {
      kind: best.bundle.kind,
      confidence: best.score,
      matchedSignals: best.signals,
      compliance: best.bundle.compliance,
    };
  }

  // 3. Private fallback when the language reads private.
  const privateHits = PRIVATE_TOKENS.filter((s) => haystack.includes(s));
  if (privateHits.length > 0) {
    return {
      kind: 'PRIVATE',
      confidence: 0.55,
      matchedSignals: privateHits.slice(0, 3),
      compliance: PRIVATE_COMPLIANCE,
    };
  }

  // 4. Nothing matched.
  return {
    kind: 'UNCLASSIFIED',
    confidence: 0,
    matchedSignals: [],
    compliance: {
      prevailingWage: false,
      davisBacon: false,
      das140Required: false,
      subListingRequired: false,
      swpppLikely: false,
    },
  };
}

/** Caller can short-circuit the heuristic by passing a funding-source
 *  string we recognize. Anything else falls through to the heuristic. */
function forceKindForFundingSource(
  s: string,
): { kind: OwnerAgencyKind; compliance: OwnerAgencyCompliance } | null {
  const norm = s.toLowerCase().trim();
  switch (norm) {
    case 'calfire':
    case 'cal-fire':
    case 'cal_fire':
    case 'cal fire grant':
    case 'calfire_grant':
      return { kind: 'CAL_FIRE', compliance: SIGNALS[1]!.compliance };
    case 'caltrans':
    case 'shopp':
    case 'rmra':
      return { kind: 'CALTRANS', compliance: SIGNALS[0]!.compliance };
    case 'fhwa':
    case 'federal-aid':
    case 'federal aid':
      return {
        kind: 'FEDERAL_OTHER',
        compliance: SIGNALS.find((b) => b.kind === 'FEDERAL_OTHER')!.compliance,
      };
    case 'fema':
      return {
        kind: 'FEDERAL_OTHER',
        compliance: SIGNALS.find((b) => b.kind === 'FEDERAL_OTHER')!.compliance,
      };
    case 'usfs':
    case 'forest service':
      return {
        kind: 'FEDERAL_FOREST_SERVICE',
        compliance: SIGNALS.find((b) => b.kind === 'FEDERAL_FOREST_SERVICE')!.compliance,
      };
    case 'blm':
      return {
        kind: 'FEDERAL_BLM',
        compliance: SIGNALS.find((b) => b.kind === 'FEDERAL_BLM')!.compliance,
      };
    case 'private':
      return { kind: 'PRIVATE', compliance: PRIVATE_COMPLIANCE };
    default:
      return null;
  }
}
