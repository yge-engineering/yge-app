// YGE preferred-supplier rules.
//
// Plain English: the nearest-by-miles pick is naïve. Real-world
// sourcing has YGE-specific patterns baked in by volume pricing,
// material quality, credit terms, who answers the phone. This module
// holds those rules so the quarry-trucking panel can flag the YGE
// preferred source per bid line — and tell the estimator WHY it
// picked that one.
//
// Encoded from Ryan's verbal sourcing rules:
//   - Sacramento-area base rock (Class 2/3 AB) → Teichert Grantline
//   - Sacramento-area top-course crushed rock → George Reed Ione
//   - Any riprap (any size) → George Reed Ione, UNLESS the job is
//     "up north" — Shasta, Tehama, Trinity, Siskiyou, Modoc, Lassen.
//     Up-north riprap sources local (Shasta Pacific Anderson, etc.).
//
// Adding new rules: append to YGE_QUARRY_PREFERENCES. Each rule is
// (material, quarryId, optional region filter, optional exclusion
// region filter, plain-English reason). Order matters — the first
// matching rule wins, so put the more-specific ones first.

import type { QuarryMaterial } from './norcal-quarries';

/** A region defined as the set of counties it covers. */
export interface CountyRegion {
  /** Stable key for the UI ("sac-area", "up-north"). */
  key: string;
  /** Plain-English label. */
  label: string;
  /** County names matched case-insensitively, no "County" suffix. */
  counties: string[];
}

/** YGE's Sacramento-area service region — anywhere that pulls
 *  Teichert / George Reed material as the default. */
export const SAC_AREA_REGION: CountyRegion = {
  key: 'sac-area',
  label: 'Sacramento area',
  counties: [
    'sacramento',
    'placer',
    'yolo',
    'el dorado',
    'sutter',
    'yuba',
    'amador',
    'san joaquin',
    'solano',
  ],
};

/** YGE's "up north" region — anywhere local quarry sourcing wins
 *  over hauling all the way south to Ione. */
export const UP_NORTH_REGION: CountyRegion = {
  key: 'up-north',
  label: 'Up north (Shasta County and further north)',
  counties: ['shasta', 'tehama', 'trinity', 'siskiyou', 'modoc', 'lassen'],
};

export interface YgeQuarryPreference {
  /** Material this rule applies to. */
  material: QuarryMaterial;
  /** Quarry id the rule prefers. Must match an id in
   *  norcal-quarries.ts. */
  quarryId: string;
  /** When supplied, the rule only matches when the job county is in
   *  this region. Omit to match everywhere. */
  whenJobCountyIn?: CountyRegion;
  /** When supplied, the rule does NOT match when the job county is
   *  in this region — falls through to the next rule (or to nearest-
   *  by-distance). */
  unlessJobCountyIn?: CountyRegion;
  /** Plain-English explanation surfaced in the UI tooltip. */
  reason: string;
}

export const YGE_QUARRY_PREFERENCES: YgeQuarryPreference[] = [
  // --- Sacramento-area base rock → Teichert Grantline ---
  {
    material: 'CLASS_2_AB',
    quarryId: 'teichert-grantline',
    whenJobCountyIn: SAC_AREA_REGION,
    reason: 'YGE default for Sac-area base rock — Teichert Grantline.',
  },
  {
    material: 'CLASS_3_AB',
    quarryId: 'teichert-grantline',
    whenJobCountyIn: SAC_AREA_REGION,
    reason: 'YGE default for Sac-area base rock — Teichert Grantline.',
  },
  // --- Sacramento-area top-course crushed rock → George Reed Ione ---
  {
    material: 'CRUSHED_ROCK_FINISH',
    quarryId: 'george-reed-ione',
    whenJobCountyIn: SAC_AREA_REGION,
    reason: 'YGE default for Sac-area top-course crushed rock — George Reed Ione.',
  },
  // --- Riprap → George Reed Ione UNLESS up north ---
  {
    material: 'RIPRAP_QUARTER_TON',
    quarryId: 'george-reed-ione',
    unlessJobCountyIn: UP_NORTH_REGION,
    reason: "YGE default riprap source. Up-north jobs source local instead.",
  },
  {
    material: 'RIPRAP_HALF_TON',
    quarryId: 'george-reed-ione',
    unlessJobCountyIn: UP_NORTH_REGION,
    reason: "YGE default riprap source. Up-north jobs source local instead.",
  },
  {
    material: 'RIPRAP_TWO_TON',
    quarryId: 'george-reed-ione',
    unlessJobCountyIn: UP_NORTH_REGION,
    reason: "YGE default riprap source. Up-north jobs source local instead.",
  },
];

/** Find the first preference rule that matches a job's county +
 *  the material in question. Returns null when no rule applies —
 *  caller falls back to nearest-by-distance. */
export function findYgePreferredQuarryId(args: {
  material: QuarryMaterial;
  jobCounty?: string;
}): { quarryId: string; reason: string } | null {
  const jobCountyLower = (args.jobCounty ?? '')
    .toLowerCase()
    .replace(/\s+county$/, '')
    .trim();
  for (const rule of YGE_QUARRY_PREFERENCES) {
    if (rule.material !== args.material) continue;
    if (
      rule.whenJobCountyIn &&
      !rule.whenJobCountyIn.counties.includes(jobCountyLower)
    ) {
      continue;
    }
    if (
      rule.unlessJobCountyIn &&
      rule.unlessJobCountyIn.counties.includes(jobCountyLower)
    ) {
      continue;
    }
    return { quarryId: rule.quarryId, reason: rule.reason };
  }
  return null;
}
