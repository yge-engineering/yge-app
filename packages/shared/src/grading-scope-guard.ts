// Site grading / mass earthwork scope guard.
//
// Fifth scope guard. Greenfield grading / pad work / mass
// earthwork. Items commonly missed when the AI focuses on the
// big cut/fill numbers and skips the support work that has
// to ride along.

import type { SubstationCheckInput } from './substation-scope-guard';

export type GradingCheckInput = SubstationCheckInput & {
  projectType?: string;
};

export interface GradingScopeItem {
  key: string;
  label: string;
  whatToCheck: string;
}

export interface GradingScopeCheck {
  isGradingJob: boolean;
  detectedKeywords: string[];
  missingItems: GradingScopeItem[];
  presentItems: GradingScopeItem[];
}

interface InternalItem extends GradingScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'clearing-grubbing',
    label: 'Clearing + grubbing',
    whatToCheck:
      'Remove brush, trees, stumps, organic surface material. Acreage-based ' +
      'usually. Goes in BEFORE any cut/fill math because grade reference is ' +
      'finished subgrade.',
    match: /(clear(ing)?\s+(and|&)?\s*grub|stripping|tree\s+remov|stump\s+remov)/i,
  },
  {
    key: 'topsoil-strip',
    label: 'Topsoil stripping + stockpile',
    whatToCheck:
      'Strip the top 6-12 in. of organic material, stockpile on-site for later ' +
      'respread on slopes / landscape areas. Often a separate item from clearing.',
    match: /(topsoil\s+(strip|stockpile)|strip\s+topsoil|organic\s+soil|stockpile\s+area)/i,
  },
  {
    key: 'mass-cut',
    label: 'Mass excavation (cut)',
    whatToCheck:
      'BCY from grading plan. Confirm bank vs loose vs compacted unit per spec.',
    match: /(mass\s+(excavat|grading)|cut\s+(to\s+fill|to\s+waste|excavation)|on[\s-]?site\s+excavat|earth(work|moving))/i,
  },
  {
    key: 'mass-fill-import',
    label: 'Mass fill + import',
    whatToCheck:
      'Volume of fill needed. If cut-to-fill is positive, import is zero. If ' +
      'negative, import from off-site (Class 2 AB or borrow) plus trucking.',
    match: /(import\s+(fill|borrow|soil)|fill\s+(borrow|import|material)|on[\s-]?site\s+fill|select\s+fill|engineered\s+fill)/i,
  },
  {
    key: 'compaction',
    label: 'Compaction',
    whatToCheck:
      'Per spec (usually 90-95% relative density). Separate pay item from fill ' +
      'when there\'s a strict density requirement.',
    match: /(compact(ion)?|relative\s+density|95%\s+compact|90%\s+compact|moisture\s+conditioning)/i,
  },
  {
    key: 'subgrade-prep',
    label: 'Subgrade preparation',
    whatToCheck:
      'Scarify, moisture-condition, recompact the top 6-12 in. Required for any ' +
      'pad receiving structural loads (building, road, equipment).',
    match: /(subgrade\s+(prep|scarif|recompact)|scarif|prepar(e|ed|ation)\s+(of\s+)?subgrade|proof\s+roll)/i,
  },
  {
    key: 'erosion-swppp',
    label: 'Erosion control / SWPPP',
    whatToCheck:
      'BMPs — straw waddles, fiber rolls, inlet protection. Required when ' +
      'disturbing 1+ acres in California.',
    match: /(erosion\s+control|swppp|bmp|fiber\s+roll|straw\s+waddle|inlet\s+protection|gravel\s+bag|silt\s+fence)/i,
  },
  {
    key: 'dust-control',
    label: 'Dust control',
    whatToCheck:
      'Water truck cycles, dust palliative. Required in any AQMD-regulated area ' +
      '(most of CA). Daily cost is real on a long grading job.',
    match: /(dust\s+control|water\s+truck|aqmd|dust\s+palliat|chemical\s+dust)/i,
  },
  {
    key: 'demo-existing',
    label: 'Existing structure / pavement demo',
    whatToCheck:
      'Remove existing buildings, slabs, foundations, asphalt that\'s in the cut/' +
      'fill zone. Usually a separate pay item from earthwork.',
    match: /(demolition|demo\s+(existing|building|slab|pavement)|remove\s+(existing\s+)?(building|structure|slab|foundation)|abandon\s+in\s+place)/i,
  },
  {
    key: 'survey-staking',
    label: 'Survey + construction staking',
    whatToCheck:
      'Licensed surveyor lays out grading limits, slope stakes, finish-grade hubs. ' +
      'Often a sub-bid line; sometimes included in mobilization.',
    match: /(survey(or|ing)?|construction\s+stake|slope\s+stake|grade\s+stake|monumentation)/i,
  },
];

const GRADING_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'mass grading',
  'site grading',
  'rough grading',
  'finish grading',
  'pad grading',
  'pad preparation',
  'earthwork',
  'mass excavation',
  'cut and fill',
  'building pad',
  'site preparation',
  'site prep',
];

function detectGrading(text: string, projectType?: string): {
  hit: boolean;
  matched: string[];
} {
  const matched: string[] = [];
  if (projectType === 'GRADING') matched.push('projectType:GRADING');
  const lower = text.toLowerCase();
  for (const kw of GRADING_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

export function checkGradingScope(
  draft: GradingCheckInput,
): GradingScopeCheck {
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectGrading(triggerText, draft.projectType);
  if (!detection.hit) {
    return {
      isGradingJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: GradingScopeItem[] = [];
  const presentItems: GradingScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const surfaced: GradingScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (item.match.test(descriptionText)) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isGradingJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
