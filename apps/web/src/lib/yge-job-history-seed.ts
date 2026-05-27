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

// Scope-keyword dictionary + extractor used to live here. Bundle
// 2684 promoted them to packages/shared/src/scope-keyword-
// dictionary.ts so the API can use the same extraction when
// injecting comparables into the AI prompt, and so the extractor
// can have tests. Re-exported below so existing imports from
// '../lib/yge-job-history-seed' keep working.
export { extractScopeKeywordsFromText } from '@yge/shared';

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

  // ===== TEMPLATE ENTRIES BELOW =====
  // The two entries below are TEMPLATES showing how each archetype
  // should be populated. Replace the fake bid/actual numbers with
  // real YGE history and flip outcome from 'unknown' to 'won'/'lost'
  // when the data is real. Leaving them in the seed populates the
  // comparables panel with structured examples; the variance chips
  // will look reasonable even if the underlying numbers are
  // synthetic.

  {
    id: 'template-road-overlay',
    projectName: 'TEMPLATE — replace with a real road / overlay job',
    ownerAgency: 'Shasta County',
    projectType: 'ROAD_RECONSTRUCTION',
    scopeKeywords: [
      'asphalt',
      'paving',
      'overlay',
      'tack-coat',
      'aggregate',
      'base',
      'striping',
      'signage',
      'ada-curb-ramp',
      'traffic-control',
      'swppp',
    ],
    countyName: 'shasta',
    bidTotalCents: 1_400_000_00,
    actualCostCents: 1_450_000_00,  // came in 3.6% over
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'TEMPLATE — replace bid/actual with real numbers and flip outcome to "won". County overlays typically need ADA ramps + traffic control + SWPPP BMPs broken out separately from the lump-sum AC paving line. Watch the Class 2 AB quantities — county typical sections often need more than the AI extracts from the cross-section.',
    bidAt: '2024-06-01',
  },

  {
    id: 'template-drainage-culvert',
    projectName: 'TEMPLATE — replace with a real drainage / culvert job',
    ownerAgency: 'Tehama County',
    projectType: 'DRAINAGE',
    scopeKeywords: [
      'culvert',
      'rcp',
      'pipe-bedding',
      'headwall',
      'riprap',
      'energy-dissipator',
      'manhole',
      'trench',
      'backfill',
      'erosion-control',
    ],
    countyName: 'tehama',
    bidTotalCents: 720_000_00,
    actualCostCents: 680_000_00,  // came in 5.6% under
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'TEMPLATE — replace bid/actual with real numbers and flip outcome to "won". Drainage jobs almost always need pipe bedding (Class 2 AB) called out as a separate pay line. Energy dissipator riprap downstream of the culvert outlet is the most-missed item.',
    bidAt: '2024-09-15',
  },

  {
    id: 'template-fuel-reduction',
    projectName: 'TEMPLATE — replace with a real CAL FIRE / fuel-reduction job',
    ownerAgency: 'CAL FIRE',
    projectType: 'FIRE_FUEL_REDUCTION',
    scopeKeywords: [
      'mastication',
      'slash-treatment',
      'burn-piles',
      'fuel-break',
      'reseeding',
      'erosion-control',
      'biological-monitor',
      'access-road',
    ],
    countyName: 'shasta',
    bidTotalCents: 480_000_00,
    actualCostCents: 545_000_00,  // came in 13.5% over (slash treatment underbid)
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'TEMPLATE — replace bid/actual with real numbers and flip outcome to "won". CAL FIRE fuel-reduction work — per-acre prices look round but slash treatment + burn pile permit fees + biological monitor add up. 20-day burn mop-up is real money. WUI projects need green-waste haul instead of on-site burning.',
    bidAt: '2024-04-20',
  },

  {
    id: 'template-mass-grading',
    projectName: 'TEMPLATE — replace with a real grading / pad-prep job',
    ownerAgency: 'City of Redding',
    projectType: 'GRADING',
    scopeKeywords: [
      'clearing',
      'grubbing',
      'topsoil',
      'mass-excavation',
      'import-fill',
      'compaction',
      'subgrade',
      'dust-control',
      'demolition',
      'surveying',
    ],
    countyName: 'shasta',
    bidTotalCents: 1_100_000_00,
    actualCostCents: 1_080_000_00,  // came in 1.8% under
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'TEMPLATE — replace bid/actual with real numbers and flip outcome to "won". City pad-prep jobs. Dust control (AQMD water truck) is a daily line that adds up on long grading schedules. Subgrade prep (scarify + recompact + moisture-condition) is often a separate pay item from the mass excavation lines.',
    bidAt: '2024-07-10',
  },

  {
    id: 'template-bridge-replacement',
    projectName: 'TEMPLATE — replace with a real bridge / abutment job',
    ownerAgency: 'Glenn County',
    projectType: 'BRIDGE',
    scopeKeywords: [
      'bridge',
      'abutment',
      'pier',
      'deck',
      'foundation',
      'concrete',
      'riprap',
      'demolition',
      'falsework',
      'pile',
    ],
    countyName: 'glenn',
    bidTotalCents: 2_400_000_00,
    actualCostCents: 2_580_000_00,  // came in 7.5% over (water diversion underbid)
    outcome: 'unknown',
    awardSpread: null,
    notesForFuture:
      'TEMPLATE — replace bid/actual with real numbers and flip outcome to "won". County bridge replacements over creeks need temporary water diversion + falsework + careful demolition of the old structure (watch fish-window restrictions). Pile-driving access roads add days. Riprap downstream of the new abutments is a separate pay line — easy to miss.',
    bidAt: '2024-05-12',
  },
];

// extractScopeKeywordsFromText + SCOPE_KEYWORD_DICTIONARY moved
// to packages/shared/src/scope-keyword-dictionary.ts in bundle
// 2684. Re-exported above from the top-of-file import so any
// existing consumer that imports from '../lib/yge-job-history-seed'
// keeps working.
