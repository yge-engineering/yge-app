// Road-reconstruction scope guard.
//
// Parallel of substation-scope-guard.ts for the other big YGE
// archetype. When the AI drafts a road / overlay / reconstruction
// bid, certain items are almost always in scope — and missing
// them is how a road bid lands wildly short.
//
// Common road-bid blind spots Ryan has called out historically:
//   - ADA curb ramps (each one is $4-8K all-in; agencies always
//     have a count somewhere on the plan set)
//   - Traffic control plans (especially nights/weekends in town)
//   - Permanent striping (often a separate line item)
//   - Erosion / SWPPP controls (BMPs, inlet protection)
//   - Loop detector replacement at signalized intersections
//
// Detection: projectType === 'ROAD_RECONSTRUCTION' OR strong
// keyword hits. Item checks: regex on bid-item descriptions.
// Loose-by-design, same as substation-scope-guard.

import type { SubstationCheckInput } from './substation-scope-guard';

/** Re-uses SubstationCheckInput's structural shape — both guards
 *  scan the same fields. Aliased for readability at call sites. */
export type RoadReconCheckInput = SubstationCheckInput & {
  /** When the draft self-classified as ROAD_RECONSTRUCTION,
   *  detection short-circuits past the keyword scan. Optional —
   *  PricedEstimate has it, PtoEOutput has it; ad-hoc callers
   *  can omit. */
  projectType?: string;
};

export interface RoadReconScopeItem {
  key: string;
  label: string;
  whatToCheck: string;
}

export interface RoadReconScopeCheck {
  isRoadJob: boolean;
  detectedKeywords: string[];
  missingItems: RoadReconScopeItem[];
  presentItems: RoadReconScopeItem[];
}

interface InternalItem extends RoadReconScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'ada-curb-ramps',
    label: 'ADA curb ramps',
    whatToCheck:
      'Plans typically call out a count on a separate sheet. Each ramp is $4-8K ' +
      'all-in (demo, forms, pour, detectable warning panels). Easy to miss when ' +
      'the bid schedule lumps them into "concrete improvements".',
    match: /(ada\s+(curb\s+)?ramp|curb\s+ramp|truncated\s+dome|detectable\s+warning)/i,
  },
  {
    key: 'traffic-control',
    label: 'Traffic control plan',
    whatToCheck:
      'Lane closures, flaggers, message boards, channelizer drums. Nights or in-town ' +
      'work can run $3K+ per shift just for the TCP crew + equipment. Check the spec ' +
      'for a separate TCP pay item.',
    match: /(traffic\s+control|tcp|lane\s+closure|flagger|channelizer|arrow\s+board|message\s+board)/i,
  },
  {
    key: 'striping',
    label: 'Permanent striping + pavement markings',
    whatToCheck:
      'Thermoplastic lane lines, edge lines, crosswalks, stop bars, RPMs. Often on ' +
      'a separate sheet from the paving plans. Some agencies sub it out, but it ' +
      'still has to be in the bid total.',
    match: /(striping|pavement\s+marking|thermoplastic|rpm|raised\s+pavement\s+marker|edge\s+line|crosswalk)/i,
  },
  {
    key: 'signage',
    label: 'Roadway signage',
    whatToCheck:
      'Permanent and temporary signs. Stop signs, speed limits, regulatory signs. ' +
      'Look for a sign-schedule sheet.',
    match: /(sign(age|s)?\s+(install|replace|remove)|sign\s+post|sign\s+panel|stop\s+sign)/i,
  },
  {
    key: 'erosion-swppp',
    label: 'Erosion control / SWPPP',
    whatToCheck:
      'BMPs — straw waddles, fiber rolls, inlet protection, gravel bags. Required ' +
      'on any project disturbing 1+ acres in California. Spec calls out the BMP ' +
      'schedule.',
    match: /(erosion\s+control|swppp|bmp|fiber\s+roll|straw\s+waddle|inlet\s+protection|gravel\s+bag)/i,
  },
  {
    key: 'subgrade-prep',
    label: 'Subgrade preparation',
    whatToCheck:
      'Scarify + recompact, lime treatment when soils are bad, geotextile fabric. ' +
      'Spec usually has a typical-section sheet showing total depth — the bottom ' +
      'layer of work is subgrade.',
    match: /(subgrade|scarif(y|ication)|geotextile|fabric|lime\s+treat)/i,
  },
  {
    key: 'aggregate-base',
    label: 'Aggregate base course',
    whatToCheck:
      'Class 2 AB under the asphalt — depth per typical section. Mass quantity is ' +
      'station-to-station × width × depth ÷ 2700 (tons per CY).',
    match: /(aggregate\s+base|class\s+2|class\s+ii|ab\s+course|crushed\s+aggregate)/i,
  },
  {
    key: 'asphalt-paving',
    label: 'Asphalt paving',
    whatToCheck:
      'HMA Type A/B/C per spec. Cubic yards or tons. Check whether overlay or full ' +
      'depth from typical section.',
    match: /(asphalt|hma|hot\s+mix|paving|overlay|ac\s+pavement)/i,
  },
  {
    key: 'tack-coat',
    label: 'Tack / prime coat',
    whatToCheck:
      'Emulsion sprayed between courses or onto subbase. Cheap per gallon but ' +
      'almost always its own pay item.',
    match: /(tack\s+coat|prime\s+coat|asphalt\s+emulsion)/i,
  },
  {
    key: 'sawcut-removal',
    label: 'Sawcut + remove existing pavement',
    whatToCheck:
      'Required everywhere new pavement meets existing — sawcut depth is the full ' +
      'lift, removal is LF of cut or SF of slab.',
    match: /(sawcut|saw\s+cut|cold\s+plane|grind(ing)?\s+ac|remove\s+(existing\s+)?(pavement|ac|concrete))/i,
  },
];

const ROAD_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'road reconstruction',
  'road rehabilitation',
  'street reconstruction',
  'street rehabilitation',
  'pavement rehabilitation',
  'overlay',
  'cold plane',
  'mill and overlay',
  'asphalt pavement',
  'roadway',
  'street improvement',
];

function detectRoad(text: string, projectType?: string): {
  hit: boolean;
  matched: string[];
} {
  const matched: string[] = [];
  if (projectType === 'ROAD_RECONSTRUCTION') {
    matched.push('projectType:ROAD_RECONSTRUCTION');
  }
  const lower = text.toLowerCase();
  for (const kw of ROAD_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

export function checkRoadReconScope(
  draft: RoadReconCheckInput,
): RoadReconScopeCheck {
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectRoad(triggerText, draft.projectType);
  if (!detection.hit) {
    return {
      isRoadJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: RoadReconScopeItem[] = [];
  const presentItems: RoadReconScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const surfaced: RoadReconScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (item.match.test(descriptionText)) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isRoadJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
