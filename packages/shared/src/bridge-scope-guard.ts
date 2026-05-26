// Bridge scope guard.
//
// Sixth and final archetype guard. Bridge work is rare for YGE
// (subbed out usually) but when it appears, the structural
// system has many "implied" items the AI may not list.

import type { SubstationCheckInput } from './substation-scope-guard';

export type BridgeCheckInput = SubstationCheckInput & {
  projectType?: string;
};

export interface BridgeScopeItem {
  key: string;
  label: string;
  whatToCheck: string;
}

export interface BridgeScopeCheck {
  isBridgeJob: boolean;
  detectedKeywords: string[];
  missingItems: BridgeScopeItem[];
  presentItems: BridgeScopeItem[];
}

interface InternalItem extends BridgeScopeItem {
  match: RegExp;
}

const REQUIRED_ITEMS: ReadonlyArray<InternalItem> = [
  {
    key: 'structure-demo',
    label: 'Existing structure demo',
    whatToCheck:
      'Bridge replacement: demolish existing deck, beams, abutments. Disposal of ' +
      'salvaged steel + concrete is a separate line.',
    match: /(structure\s+demo|bridge\s+(demo|remov)|demolish.*(bridge|deck|abutment)|deck\s+remov)/i,
  },
  {
    key: 'falsework',
    label: 'Falsework + shoring',
    whatToCheck:
      'Temporary support for deck pours. Engineered design + erection + removal. ' +
      'Often $20-100K depending on span.',
    match: /(falsework|temporary\s+(shor|support)|deck\s+shor|forming\s+falsework)/i,
  },
  {
    key: 'rebar',
    label: 'Reinforcing steel',
    whatToCheck:
      'Tons of #4 through #11 rebar plus tie wire. Cast-in-place sections have ' +
      'lots of it. Often a sub-bid line.',
    match: /(reinforc(ing|ement)\s+(steel|bar)|rebar|#\s*\d+\s+bar|tie\s+wire|epoxy[\s-]?coat)/i,
  },
  {
    key: 'cip-concrete',
    label: 'Cast-in-place concrete',
    whatToCheck:
      'Cubic yards of structural concrete per spec class. Deck, abutments, piers, ' +
      'wingwalls. Multiple pour lines usually.',
    match: /(cast[\s-]?in[\s-]?place|cip\s+concret|class\s+a\s+concret|structural\s+concret|deck\s+(pour|concrete))/i,
  },
  {
    key: 'joint-seals',
    label: 'Expansion joint seals',
    whatToCheck:
      'Modular or strip-seal joints at deck breaks. Spec calls out joint type by ' +
      'Caltrans standard plan.',
    match: /(joint\s+(seal|system)|expansion\s+joint|modular\s+joint|strip\s+seal|deck\s+joint)/i,
  },
  {
    key: 'bridge-railing',
    label: 'Bridge railing / barrier',
    whatToCheck:
      'Type 26, Type 7, Type 80, etc. Concrete barrier or steel railing. MASH-tested.',
    match: /(bridge\s+(rail|barrier)|type\s+\d{1,2}\s+barrier|type\s+\d{1,2}\s+rail|concrete\s+barrier|safety\s+barrier)/i,
  },
  {
    key: 'approach-slab',
    label: 'Approach slabs',
    whatToCheck:
      'Cast-in-place transition between bridge deck and earthwork on each end. ' +
      'Usually 20-30 ft long, separate pay item.',
    match: /(approach\s+(slab|pavement)|sleeper\s+slab|bridge\s+approach)/i,
  },
  {
    key: 'deck-waterproofing',
    label: 'Bridge deck waterproofing / overlay',
    whatToCheck:
      'Methacrylate flood seal, polymer overlay, or AC overlay. Required to seal ' +
      'rebar from de-icing salts.',
    match: /(methacrylate|polymer\s+overlay|deck\s+(seal|overlay|membrane)|waterproof.*(deck|bridge))/i,
  },
  {
    key: 'bearings',
    label: 'Bridge bearings',
    whatToCheck:
      'Elastomeric pads or pot bearings between superstructure and abutment / pier ' +
      'caps. Usually shipped from a supplier.',
    match: /(bridge\s+bearing|elastomeric\s+(bearing|pad)|pot\s+bearing|bearing\s+pad)/i,
  },
  {
    key: 'pile-driving',
    label: 'Pile driving / drilled shafts',
    whatToCheck:
      'When abutments / piers are on piles. CIDH (cast-in-drilled-hole) or driven ' +
      'piles. Specialty sub.',
    match: /(pile\s+driv|drilled\s+shaft|cidh|cast[\s-]?in[\s-]?drilled|h-pile|pipe\s+pile)/i,
  },
];

const BRIDGE_TRIGGER_KEYWORDS: ReadonlyArray<string> = [
  'bridge',
  'overcrossing',
  'overpass',
  'underpass',
  'overhead structure',
  'pedestrian bridge',
  'vehicular bridge',
  'box girder',
  'precast girder',
  'deck replacement',
  'bridge widening',
  'bridge rehabilitation',
];

function detectBridge(text: string, projectType?: string): {
  hit: boolean;
  matched: string[];
} {
  const matched: string[] = [];
  if (projectType === 'BRIDGE') matched.push('projectType:BRIDGE');
  const lower = text.toLowerCase();
  for (const kw of BRIDGE_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

export function checkBridgeScope(draft: BridgeCheckInput): BridgeScopeCheck {
  const triggerText = [
    draft.projectName,
    draft.ownerAgency ?? '',
    ...draft.bidItems.map((i) => i.description),
    ...(draft.assumptions ?? []),
  ].join(' \n ');

  const detection = detectBridge(triggerText, draft.projectType);
  if (!detection.hit) {
    return {
      isBridgeJob: false,
      detectedKeywords: [],
      missingItems: [],
      presentItems: [],
    };
  }

  const descriptionText = draft.bidItems.map((i) => i.description).join(' \n ');

  const missingItems: BridgeScopeItem[] = [];
  const presentItems: BridgeScopeItem[] = [];
  for (const item of REQUIRED_ITEMS) {
    const surfaced: BridgeScopeItem = {
      key: item.key,
      label: item.label,
      whatToCheck: item.whatToCheck,
    };
    if (item.match.test(descriptionText)) presentItems.push(surfaced);
    else missingItems.push(surfaced);
  }

  return {
    isBridgeJob: true,
    detectedKeywords: detection.matched,
    missingItems,
    presentItems,
  };
}
