// YGE_JOB_HISTORY_SEED — hand-curated past jobs the comparables
// matcher draws from on /drafts/[id]. Lives in the web app (not
// shared/) because it's YGE-specific reference data, not a
// reusable algorithm.
//
// Goal: at minimum, every job Ryan has personally taught the AI
// about in conversation belongs here so the AI (and the UI) can
// reach for it as a reality check on new bids. The very first
// entry — Powerline/Allbaugh — is the SMUD substation the v1
// vision takeoff missed by 4× ($814K AI vs $3.1M actual), the
// motivating example for the whole rate-tables-and-comparables
// arc. Including it as a seed makes sure the next time the AI
// drafts a similar substation bid, this cautionary tale shows up.
//
// Each entry is a HistoricalJob. Some fields will be null until
// Ryan fills them in; the matcher and the UI both tolerate that.
//
// Eventually this seed gets swapped for a DB query (real Job +
// BidResult rows joined with actual cost). Until then, edits go
// here.

import type { HistoricalJob } from '@yge/shared';

export const YGE_JOB_HISTORY_SEED: ReadonlyArray<HistoricalJob> = [
  {
    id: 'seed-powerline-allbaugh',
    projectName: 'Powerline / Allbaugh Substation Upgrades',
    ownerAgency: 'SMUD',
    projectType: 'OTHER',
    scopeKeywords: [
      'substation',
      'transformer-foundation',
      'duct-bank',
      'conduit',
      'ground-grid',
      'oil-containment',
      'cmu-wall',
      'control-house',
    ],
    countyName: 'sacramento',
    // Original bid as estimated by v1 vision takeoff — kept here
    // for the variance comparison. NOT a real YGE bid number;
    // representative of how far the AI undershot.
    bidTotalCents: 814_000_00,
    actualCostCents: 3_100_000_00,
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'SMUD furnishes nothing but the gate latches — contractor buys ALL conduit and grounding. Transformer foundations and duct-bank conduit (4-conduit and larger) burn way more crew-days than single-conduit rates. Site is LIVE — schedule 5-6 months not 8 weeks. Quarry haul to Elk Grove (Teichert Grantline) and Ione (George Reed) priced separately.',
    bidAt: '2024-08-15',
  },
];

// Helper for the panel: pull lowercased scope keywords out of a
// draft's bid-item descriptions. Tiny dictionary, on purpose —
// we want hits to be specific enough to be meaningful, not vague
// noun-matches.
const SCOPE_KEYWORD_DICTIONARY = [
  'asphalt',
  'paving',
  'concrete',
  'curb',
  'sidewalk',
  'pad',
  'foundation',
  'transformer-foundation',
  'conduit',
  'duct-bank',
  'trench',
  'pipe',
  'sewer',
  'storm',
  'culvert',
  'manhole',
  'rcb',
  'rcp',
  'hdpe',
  'pvc',
  'aggregate',
  'rock',
  'base',
  'riprap',
  'fill',
  'cut',
  'export',
  'import',
  'grading',
  'clearing',
  'demolition',
  'striping',
  'signage',
  'guardrail',
  'fence',
  'gate',
  'erosion',
  'swppp',
  'control-house',
  'cmu-wall',
  'masonry',
  'ground-grid',
  'oil-containment',
  'substation',
  'bridge',
  'abutment',
  'pier',
  'deck',
  'culvert-extension',
] as const;

export function extractScopeKeywordsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const k of SCOPE_KEYWORD_DICTIONARY) {
    // Dictionary entries with hyphens (e.g. "duct-bank") match
    // when either the hyphenated OR space-separated form appears.
    const spaceForm = k.replace(/-/g, ' ');
    if (lower.includes(k) || lower.includes(spaceForm)) {
      found.add(k);
    }
  }
  return [...found];
}
