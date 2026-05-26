// Drainage / culvert scope guard.
//
// Third scope guard after substation (2566) and road-recon
// (2569). Catches when the AI drafts a drainage / culvert /
// storm bid and omits the secondary items that ride along
// with the pipe itself. The headline pipe is rarely missed;
// the bedding, backfill, energy dissipator, and bank
// stabilization are the common gaps.

import type { SubstationCheckInput } from './substation-scope-guard';

export type DrainageCheckInput = SubstationCheckInput & {
  projectType?: string;
};

export interface DrainageScopeItem {
  key: string;
  label: string;
  whatToCheck: string;
}

export interface DrainageScopeCheck {
  isDrainageJob: boolean;
  detectedKeywords: string[];
  missingItems: DrainageScopeItem[];
  presentItems: DrainageScopeItem[];
}

interface InternalItem extends DrainageScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'pipe-bedding',
    label: 'Pipe bedding',
    whatToCheck:
      'Class 2 AB or pea gravel under and around the pipe per typical-section. ' +
      'Usually 4-6 in. below + 12 in. above the pipe crown.',
    match: /(pipe\s+bedding|bedding\s+(material|sand|gravel)|pea\s+gravel|class\s+2\s+(ab\s+)?bedding)/i,
  },
  {
    key: 'trench-excavation',
    label: 'Trench excavation',
    whatToCheck:
      'Volume of dig for pipe + bedding + clearance. Includes shoring/sloping when ' +
      'depth > 5 ft per Cal/OSHA.',
    match: /(trench\s+(excav|dig)|excavate\s+trench|pipe\s+trench)/i,
  },
  {
    key: 'trench-backfill',
    label: 'Trench backfill + compaction',
    whatToCheck:
      'Native or imported, compacted to spec (usually 90-95% relative). Often a ' +
      'separate pay item from the trench excavation.',
    match: /(trench\s+backfill|backfill\s+(and|&)?\s*compact|compact(ed)?\s+backfill|imported\s+fill)/i,
  },
  {
    key: 'headwall-endwall',
    label: 'Headwall / endwall',
    whatToCheck:
      'Cast-in-place or precast at each end of the culvert. Sized for pipe diameter + ' +
      'flowline depth.',
    match: /(headwall|end\s*wall|wing\s*wall|flared\s+end\s+section|fes\b)/i,
  },
  {
    key: 'riprap-energy-dissipator',
    label: 'Riprap / energy dissipator',
    whatToCheck:
      'Outlet protection at downstream end. Rock sized per spec — usually Caltrans ' +
      'class designation. Includes filter fabric beneath.',
    match: /(riprap|rip[\s-]?rap|energy\s+dissipator|outlet\s+protection|rock\s+slope\s+protect)/i,
  },
  {
    key: 'inlet-catch-basin',
    label: 'Inlets / catch basins',
    whatToCheck:
      'Where surface water enters the system — curb inlet, drop inlet, grate inlet. ' +
      'Each one is a structure with bottom slab + frame + grate.',
    match: /(catch\s+basin|drop\s+inlet|curb\s+inlet|grate\s+inlet|area\s+drain|inlet\s+(structure|frame))/i,
  },
  {
    key: 'manhole-junction',
    label: 'Manholes / junction structures',
    whatToCheck:
      'Required at direction / grade / size changes and every 300-400 ft on long runs. ' +
      'Precast riser sections + cone + frame + cover.',
    match: /(manhole|maintenance\s+hole|junction\s+(box|structure)|drainage\s+structure)/i,
  },
  {
    key: 'erosion-swppp',
    label: 'Erosion control / SWPPP BMPs',
    whatToCheck:
      'Required when disturbing 1+ acres or working in/near a waterway. Straw waddles, ' +
      'fiber rolls, gravel bags, inlet protection.',
    match: /(erosion\s+control|swppp|bmp|fiber\s+roll|straw\s+waddle|gravel\s+bag|inlet\s+protection)/i,
  },
  {
    key: 'slope-protection',
    label: 'Slope / bank protection',
    whatToCheck:
      'Geotextile fabric, slope paving, articulated block, or vegetated mat. Specified ' +
      'where the channel meets the road embankment.',
    match: /(slope\s+(protect|paving)|bank\s+(stabiliz|protect)|articulated\s+block|geotextile|slope\s+pav)/i,
  },
  {
    key: 'utility-conflict',
    label: 'Utility conflicts (relocate / pothole)',
    whatToCheck:
      'Drainage trenches almost always cross water / gas / electric. USA potholing + ' +
      'temporary support of utilities is real money — separate pay item or T&M.',
    match: /(pothol|usa\s+mark|utility\s+(reloc|support|conflict)|support\s+of\s+excav)/i,
  },
];

const DRAINAGE_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'drainage',
  'culvert',
  'storm drain',
  'storm sewer',
  'rcp',
  'rcb',
  'reinforced concrete pipe',
  'reinforced concrete box',
  'hdpe pipe',
  'sd pipe',
  'channel improvement',
  'detention basin',
];

function detectDrainage(text: string, projectType?: string): {
  hit: boolean;
  matched: string[];
} {
  const matched: string[] = [];
  if (projectType === 'DRAINAGE') matched.push('projectType:DRAINAGE');
  const lower = text.toLowerCase();
  for (const kw of DRAINAGE_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

export function checkDrainageScope(
  draft: DrainageCheckInput,
): DrainageScopeCheck {
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectDrainage(triggerText, draft.projectType);
  if (!detection.hit) {
    return {
      isDrainageJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: DrainageScopeItem[] = [];
  const presentItems: DrainageScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const surfaced: DrainageScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (item.match.test(descriptionText)) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isDrainageJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
