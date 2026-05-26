// Substation-civil scope guard.
//
// Programmatic mirror of the SYSTEM PROMPT's "SUBSTATION CIVIL —
// REQUIRED SCOPE CHECKLIST" (apps/api/.../plans-to-estimate-v1.ts).
// The AI is told to walk that list and price everything even when
// the agency bid schedule doesn't list it. This helper verifies
// after the fact: scan the draft's bid items, flag any required
// scope item that's missing.
//
// The Powerline/Allbaugh failure was a missing transformer-
// foundation line. The AI didn't even include the item, so the
// estimator couldn't catch the gap by reviewing prices alone.
// This guard surfaces gaps as a red banner on /drafts/[id]
// BEFORE the conversion-to-estimate step.
//
// Detection logic is intentionally loose — false positives ("the
// drawings DO show a ground grid but the AI just didn't put 'grid'
// in the line description") are fine; the estimator dismisses them.
// False negatives (missing scope item that the guard didn't flag)
// are the failure mode this is meant to prevent.

/** Minimum draft/estimate shape the scope guard needs. Both
 *  PtoEOutput (raw AI draft) and PricedEstimate (post-conversion)
 *  satisfy it structurally so the same check fires on both
 *  /drafts/[id] and the bid-day cockpit. */
export interface SubstationCheckInput {
  projectName: string;
  ownerAgency?: string;
  bidItems: ReadonlyArray<{ description: string }>;
  assumptions?: ReadonlyArray<string>;
}

export interface SubstationScopeItem {
  /** Stable id, e.g. "transformer-foundation". */
  key: string;
  /** Short label for the UI banner. */
  label: string;
  /** Plain-English help text — what should the estimator look at? */
  whatToCheck: string;
}

export interface SubstationScopeCheck {
  /** Did the draft pattern-match as a substation civil job? */
  isSubstationJob: boolean;
  /** Heuristic keywords that triggered the substation detection.
   *  Useful when isSubstationJob is true but seems wrong. */
  detectedKeywords: string[];
  /** Required scope items that appear nowhere in the draft. Empty
   *  when isSubstationJob is false. */
  missingItems: SubstationScopeItem[];
  /** Required scope items that are present somewhere in the draft.
   *  Mirror of missingItems for UI completeness. */
  presentItems: SubstationScopeItem[];
}

// ---- Catalog of required substation-civil scope items ----
// Each entry's `match` regex is tested against the joined
// description text of every bid item. Empty match means "always
// missing if not explicitly added" (no current entries use this).
interface InternalItem extends SubstationScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'transformer-foundation',
    label: 'Transformer foundations',
    whatToCheck:
      'Structural / foundation sheets — usually one foundation per transformer. ' +
      'Each is 2-7 crew-days (excavate, form, rebar, anchor-bolt template, pour, cure, strip). ' +
      'Powerline/Allbaugh missed this and the bid was $2.3M short.',
    match: /transformer\s+(foundation|pad)|tx\s+pad|xfmr\s+pad/i,
  },
  {
    key: 'switchgear-equipment-pad',
    label: 'Switchgear / equipment pads',
    whatToCheck:
      'Separate foundations for each piece of equipment — PCB, MOAB, riser stand, ' +
      'dead-end structure, etc. One pad per major device.',
    match: /(switchgear|equipment|pcb|moab|riser|dead[\s-]?end)\s+(pad|foundation)/i,
  },
  {
    key: 'concrete-encased-duct-bank',
    label: 'Concrete-encased duct bank',
    whatToCheck:
      'Multiple conduits per bank. 30-80 LF/day for 4-6 conduits; 15-40 LF/day for 8+. ' +
      'NEVER use the single-conduit trench rate for substation duct banks.',
    match: /(duct[\s-]?bank|ductbank|encased\s+conduit)/i,
  },
  {
    key: 'pull-boxes-manholes',
    label: 'Pull boxes / manholes / handholes',
    whatToCheck:
      'Typically every 200-400 ft of duct bank plus at every direction change. ' +
      'Count from the utility plan.',
    match: /(pull[\s-]?box|manhole|handhole|maintenance\s+hole)/i,
  },
  {
    key: 'ground-grid',
    label: 'Ground grid + ground rods',
    whatToCheck:
      'Bare copper trenched in a grid pattern across the yard, cad-welded rods at ' +
      'intersections. Total LF of copper + count of rods.',
    match: /(ground(ing)?\s+grid|ground\s+rod|cad[\s-]?weld)/i,
  },
  {
    key: 'oil-containment',
    label: 'Oil containment system',
    whatToCheck:
      'Perimeter berm + HDPE liner + concrete curb wall + drain sump around the ' +
      'transformer pad. Sized for 110% of largest tank oil volume.',
    match: /(oil[\s-]?containment|containment\s+berm|oil\s+spill|hdpe\s+liner)/i,
  },
  {
    key: 'perimeter-fence',
    label: 'Perimeter fence + gates',
    whatToCheck:
      'Chain-link with barbed wire, man gate, vehicle swing gate.',
    match: /(chain[\s-]?link|perimeter\s+fence|security\s+fence|swing\s+gate)/i,
  },
  {
    key: 'yard-rock',
    label: 'Yard rock surfacing',
    whatToCheck:
      'Typically Class 2 AB or substation-spec yard rock at 4-6 in. depth across ' +
      'the entire fenced area.',
    match: /(yard\s+rock|substation\s+rock|crushed\s+rock\s+surfacing|class\s+2\s+ab.*yard)/i,
  },
  {
    key: 'mfrc-scada-trench',
    label: 'MFRC / SCADA control trenches',
    whatToCheck:
      'Small-diameter conduit trenches for fiber / control wiring between equipment ' +
      '— separate from power duct banks.',
    match: /(mfrc|scada|control\s+(conduit|trench)|fiber\s+conduit)/i,
  },
  {
    key: 'control-house',
    label: 'Control house / equipment enclosure',
    whatToCheck:
      'CMU building or prefab control enclosure with utility tie-ins.',
    match: /(control\s+house|control\s+building|cmu\s+(wall|building)|prefab\s+(building|enclosure))/i,
  },
  {
    key: 'yard-lighting',
    label: 'Yard lighting foundations + conduit',
    whatToCheck:
      'Pole bases + branch conduit for area lighting.',
    match: /(yard\s+light|area\s+light|pole\s+base|light(ing)?\s+pole)/i,
  },
  {
    key: 'spill-berm-storm',
    label: 'Spill berm + storm drain modifications',
    whatToCheck:
      'Separate from the oil-containment system — site drainage routing changes.',
    match: /(spill\s+berm|storm\s+drain.*modific|catch\s+basin)/i,
  },
];

// ---- Substation detection ----
const SUBSTATION_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'substation',
  'switchyard',
  'switchgear',
  'transformer',
  'smud',
  'pg&e substation',
  'distribution station',
  'control house',
  'ground grid',
];

function detectSubstation(text: string): {
  hit: boolean;
  matched: string[];
} {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of SUBSTATION_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

/** Check a Plans-to-Estimate draft (or priced estimate) for missing
 *  substation-civil scope. Returns isSubstationJob:false (with empty
 *  missingItems) when the draft doesn't look like a substation job
 *  at all. */
export function checkSubstationCivilScope(
  draft: SubstationCheckInput,
): SubstationScopeCheck {
  // Pool of text the detection scans — every field that might
  // contain the trigger keywords.
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectSubstation(triggerText);
  if (!detection.hit) {
    return {
      isSubstationJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  // Pool of text the per-item match scans — descriptions only,
  // because notes might mention "no oil containment" or similar
  // negation that would confuse the regex.
  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: SubstationScopeItem[] = [];
  const presentItems: SubstationScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const found = item.match.test(descriptionText);
    const surfaced: SubstationScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (found) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isSubstationJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
