// Fire-fuel reduction scope guard.
//
// Fourth scope guard. YGE specializes in vegetation management /
// fuel-reduction work for CAL FIRE and others (per CLAUDE.md).
// These jobs are easy to under-bid because the work is mostly
// labor and the per-acre prices are deceptively round —
// estimators forget the secondary items.
//
// Items commonly missed:
//   - Slash treatment after mastication (pile, chip, lop-and-scatter)
//   - Burn piles (CAL FIRE permits + days of monitoring after)
//   - Green waste hauling (when piling/chipping isn't allowed)
//   - Fire-break construction (different from fuel-break)
//   - Reseeding / revegetation (often required after disturbance)
//   - Erosion control on slopes
//   - Sensitive resource avoidance (oak retention, nest surveys)
//   - Equipment access roads / turnouts

import type { SubstationCheckInput } from './substation-scope-guard';

export type FuelReductionCheckInput = SubstationCheckInput & {
  projectType?: string;
};

export interface FuelReductionScopeItem {
  key: string;
  label: string;
  whatToCheck: string;
}

export interface FuelReductionScopeCheck {
  isFuelReductionJob: boolean;
  detectedKeywords: string[];
  missingItems: FuelReductionScopeItem[];
  presentItems: FuelReductionScopeItem[];
}

interface InternalItem extends FuelReductionScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'slash-treatment',
    label: 'Slash treatment',
    whatToCheck:
      'After mastication / cut, the resulting slash has to go somewhere. ' +
      'Lop-and-scatter, pile, chip, or haul — each is a separate pay item ' +
      'with very different unit prices.',
    match: /(slash\s+(treat|pile|disposal)|lop[\s-]?and[\s-]?scatter|chip(ping)?\s+(of\s+)?slash|hand\s+pile)/i,
  },
  {
    key: 'burn-piles',
    label: 'Burn piles + permit / monitoring',
    whatToCheck:
      'CAL FIRE burn permit fees + days of crew monitoring after the burn. ' +
      'A 20-day mop-up is common on bigger piles. Easily $5K+ per crew-day.',
    match: /(burn\s+pile|prescribed\s+burn|pile\s+burn|burn\s+monitor|burn\s+permit)/i,
  },
  {
    key: 'green-waste-haul',
    label: 'Green waste hauling',
    whatToCheck:
      'Required when on-site disposal isn\'t allowed (urban / WUI / sensitive ' +
      'site). Volume of slash × cycles × distance to nearest green-waste yard.',
    match: /(green\s+waste|haul\s+(off\s+)?(slash|debris|vegetation)|debris\s+(haul|disposal)|chip(ped)?\s+haul)/i,
  },
  {
    key: 'fire-break',
    label: 'Fire break / fuel break construction',
    whatToCheck:
      'Dozer-cut or hand-cut break to mineral soil. Different deliverable than ' +
      'fuel-reduction — denser standard, no live fuel allowed.',
    match: /(fire\s*break|fuel\s*break|shaded\s+fuel\s+break|defensible\s+space)/i,
  },
  {
    key: 'reseeding',
    label: 'Reseeding / revegetation',
    whatToCheck:
      'Required when treatment disturbs soil > X SF. Native seed mix per spec, ' +
      'broadcast or drilled, with straw mulch cover.',
    match: /(reseed|revegetation|native\s+seed|hydroseed|straw\s+mulch|broadcast\s+seed)/i,
  },
  {
    key: 'erosion-control',
    label: 'Erosion control on slopes',
    whatToCheck:
      'Straw waddles, jute netting, or rock check dams on cleared slopes > 25% grade. ' +
      'Most fuel-reduction specs require these on any disturbed slope.',
    match: /(erosion\s+control|straw\s+waddle|fiber\s+roll|jute\s+net|check\s+dam|silt\s+fence)/i,
  },
  {
    key: 'resource-avoidance',
    label: 'Sensitive resource avoidance',
    whatToCheck:
      'Oak retention (no work within drip line of certain species), nest surveys ' +
      'pre-clearing, archaeological monitor for known sites. Spec calls out the ' +
      'biological / cultural monitor cost.',
    match: /(oak\s+(retention|protection)|nest\s+survey|biological\s+monitor|cultural\s+monitor|archaeolog|protected\s+species|raptor\s+nest)/i,
  },
  {
    key: 'access-road',
    label: 'Equipment access / turnouts',
    whatToCheck:
      'Brush projects in remote areas need temporary access road improvements — ' +
      'turnouts for crew trucks, water tender access, fuel staging.',
    match: /(access\s+road|temporary\s+road|turnout|water\s+tender|staging\s+area)/i,
  },
];

const FUEL_REDUCTION_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'fuel reduction',
  'fuel break',
  'fuels treatment',
  'vegetation management',
  'mastication',
  'mastic',
  'brush clearing',
  'brush removal',
  'thinning',
  'cal fire',
  'shaded fuel',
  'defensible space',
  'wildfire',
  'wildland-urban interface',
  'wui',
];

function detectFuelReduction(text: string, projectType?: string): {
  hit: boolean;
  matched: string[];
} {
  const matched: string[] = [];
  if (projectType === 'FIRE_FUEL_REDUCTION') {
    matched.push('projectType:FIRE_FUEL_REDUCTION');
  }
  const lower = text.toLowerCase();
  for (const kw of FUEL_REDUCTION_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

export function checkFuelReductionScope(
  draft: FuelReductionCheckInput,
): FuelReductionScopeCheck {
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectFuelReduction(triggerText, draft.projectType);
  if (!detection.hit) {
    return {
      isFuelReductionJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: FuelReductionScopeItem[] = [];
  const presentItems: FuelReductionScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const surfaced: FuelReductionScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (item.match.test(descriptionText)) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isFuelReductionJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
