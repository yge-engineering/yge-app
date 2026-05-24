// NorCal aggregate quarry / batch-plant directory.
//
// Used by the trucking-cycle helper to pick the nearest quarry that
// supplies the material a bid item needs, then compute haul cost as
// (loads × cycle_time × hourly_truck_rate).
//
// Coverage: the suppliers YGE routinely buys from + the larger
// regional plants that come up when YGE bids further afield. Each
// quarry carries lat/lng + a `materials` list so the lookup can
// filter by "who sells Class 2 AB" / "who sells drain rock" / etc.
//
// Pricing notes are typical mid-2026 NorCal door-price ranges and
// move with the market. The hauling helper applies its own per-mile
// math on top; the door price is what's loaded on the truck.

export type QuarryMaterial =
  | 'CLASS_2_AB'
  | 'CLASS_3_AB'
  | 'CRUSHED_MISC_BASE'
  | 'CRUSHED_ROCK_FINISH' // top-course / finish-layer crushed rock
  | 'DRAIN_ROCK_34'
  | 'DRAIN_ROCK_15'
  | 'SAND_CONCRETE'
  | 'SAND_BEDDING'
  | 'RIPRAP_QUARTER_TON'
  | 'RIPRAP_HALF_TON'
  | 'RIPRAP_TWO_TON'
  | 'HMA_TYPE_A'
  | 'HMA_RHMA'
  | 'COLD_MIX'
  | 'PCC_READY_MIX'
  | 'IMPORT_BORROW_FILL';

export interface NorcalQuarry {
  /** Stable id. */
  id: string;
  /** Display name (supplier + plant). */
  name: string;
  /** Street city (for the haul-route hint, not the centroid math). */
  city: string;
  state: 'CA' | 'OR' | 'NV';
  county: string;
  lat: number;
  lng: number;
  /** Materials this plant routinely supplies. The matcher filters on
   *  this list — a plant that only sells PCC won't get picked for a
   *  Class 2 AB line. */
  materials: QuarryMaterial[];
  /** Plain-English note — who they are, what they're known for. */
  note?: string;
}

export const NORCAL_QUARRIES: NorcalQuarry[] = [
  // --- Redding / Anderson corridor (closest to YGE) ---
  {
    id: 'knife-river-redding',
    name: 'Knife River — Redding plant',
    city: 'Redding',
    state: 'CA',
    county: 'Shasta',
    lat: 40.6112,
    lng: -122.3531,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'DRAIN_ROCK_15',
      'SAND_CONCRETE',
      'SAND_BEDDING',
      'HMA_TYPE_A',
      'HMA_RHMA',
      'PCC_READY_MIX',
    ],
    note: "Knife River's main Shasta plant. Full hot-mix + aggregate + ready-mix.",
  },
  {
    id: 'granite-anderson',
    name: 'Granite Construction — Anderson plant',
    city: 'Anderson',
    state: 'CA',
    county: 'Shasta',
    lat: 40.4505,
    lng: -122.2987,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'HMA_TYPE_A',
      'HMA_RHMA',
      'IMPORT_BORROW_FILL',
    ],
    note: 'Aggregate + hot-mix. Cottonwood + Anderson area bids almost always source here or Knife River.',
  },
  {
    id: 'shasta-pacific-anderson',
    name: 'Shasta Pacific Aggregates — Anderson',
    city: 'Anderson',
    state: 'CA',
    county: 'Shasta',
    lat: 40.4426,
    lng: -122.2925,
    materials: [
      'CLASS_2_AB',
      'DRAIN_ROCK_34',
      'DRAIN_ROCK_15',
      'SAND_CONCRETE',
      'SAND_BEDDING',
      'RIPRAP_QUARTER_TON',
      'RIPRAP_HALF_TON',
      'IMPORT_BORROW_FILL',
    ],
    note: 'Aggregate + sand + smaller riprap. Often the cheap source for fill on local jobs.',
  },
  // --- Red Bluff area ---
  {
    id: 'knife-river-red-bluff',
    name: 'Knife River — Red Bluff plant',
    city: 'Red Bluff',
    state: 'CA',
    county: 'Tehama',
    lat: 40.1791,
    lng: -122.2421,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'HMA_TYPE_A',
      'PCC_READY_MIX',
    ],
    note: 'Closest plant for Red Bluff / Corning / Los Molinos work.',
  },
  // --- Chico / Oroville corridor ---
  {
    id: 'baldwin-chico',
    name: 'Baldwin Contracting — Chico plant',
    city: 'Chico',
    state: 'CA',
    county: 'Butte',
    lat: 39.7396,
    lng: -121.8421,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'HMA_TYPE_A',
      'HMA_RHMA',
      'PCC_READY_MIX',
    ],
  },
  {
    id: 'knife-river-chico',
    name: 'Knife River — Chico plant',
    city: 'Chico',
    state: 'CA',
    county: 'Butte',
    lat: 39.7641,
    lng: -121.8156,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'DRAIN_ROCK_34',
      'HMA_TYPE_A',
      'PCC_READY_MIX',
    ],
  },
  // --- Yuba / Marysville ---
  {
    id: 'teichert-marysville',
    name: 'Teichert Materials — Marysville',
    city: 'Marysville',
    state: 'CA',
    county: 'Yuba',
    lat: 39.1481,
    lng: -121.5946,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'SAND_BEDDING',
      'HMA_TYPE_A',
      'HMA_RHMA',
      'PCC_READY_MIX',
    ],
    note: 'Large Sacramento-Valley supplier. Good source for Yuba City / Live Oak / Gridley jobs.',
  },
  // --- Sacramento / Roseville ---
  {
    id: 'teichert-perkins',
    name: 'Teichert — Perkins plant (Sacramento)',
    city: 'Sacramento',
    state: 'CA',
    county: 'Sacramento',
    lat: 38.5538,
    lng: -121.3784,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'HMA_TYPE_A',
      'HMA_RHMA',
      'PCC_READY_MIX',
    ],
  },
  {
    id: 'teichert-grantline',
    name: 'Teichert — Grantline rock quarry (Elk Grove)',
    city: 'Elk Grove',
    state: 'CA',
    county: 'Sacramento',
    lat: 38.4258,
    lng: -121.2778,
    materials: [
      'CLASS_2_AB',
      'CLASS_3_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'DRAIN_ROCK_15',
      'SAND_CONCRETE',
      'SAND_BEDDING',
      'IMPORT_BORROW_FILL',
    ],
    note: "YGE's go-to base-rock quarry for any Sacramento-area job. Volume pricing + reliable Class 2 AB.",
  },
  {
    id: 'george-reed-ione',
    name: 'George Reed Inc. — Jackson/Ione plant',
    city: 'Ione',
    state: 'CA',
    county: 'Amador',
    lat: 38.3527,
    lng: -120.9333,
    materials: [
      'CRUSHED_ROCK_FINISH',
      'DRAIN_ROCK_34',
      'DRAIN_ROCK_15',
      'RIPRAP_QUARTER_TON',
      'RIPRAP_HALF_TON',
      'RIPRAP_TWO_TON',
      'CRUSHED_MISC_BASE',
    ],
    note: "YGE's go-to source for top-course crushed rock + riprap on any job that isn't up north (Shasta County and further north source local).",
  },
  {
    id: 'granite-roseville',
    name: 'Granite Construction — Roseville plant',
    city: 'Roseville',
    state: 'CA',
    county: 'Placer',
    lat: 38.7521,
    lng: -121.2880,
    materials: [
      'CLASS_2_AB',
      'CRUSHED_MISC_BASE',
      'DRAIN_ROCK_34',
      'SAND_CONCRETE',
      'HMA_TYPE_A',
      'PCC_READY_MIX',
    ],
  },
  // --- Yreka / Siskiyou ---
  {
    id: 'jsmith-yreka',
    name: 'J.F. Smith Aggregates — Yreka',
    city: 'Yreka',
    state: 'CA',
    county: 'Siskiyou',
    lat: 41.7396,
    lng: -122.6418,
    materials: [
      'CLASS_2_AB',
      'DRAIN_ROCK_34',
      'SAND_BEDDING',
      'RIPRAP_QUARTER_TON',
      'IMPORT_BORROW_FILL',
    ],
    note: 'Far-north plant. The default for Yreka / Mount Shasta / Weed work.',
  },
  // --- Trinity (limited supply — most material hauled in from Redding) ---
  {
    id: 'tcaggregate-weaverville',
    name: 'Trinity County Aggregate — Weaverville',
    city: 'Weaverville',
    state: 'CA',
    county: 'Trinity',
    lat: 40.7307,
    lng: -122.9421,
    materials: ['CLASS_2_AB', 'DRAIN_ROCK_34', 'RIPRAP_QUARTER_TON'],
    note: 'Small operation. For larger Trinity jobs the haul typically comes from Redding (~50 mi).',
  },
];

/** Filter the directory to plants that supply a specific material. */
export function quarriesForMaterial(material: QuarryMaterial): NorcalQuarry[] {
  return NORCAL_QUARRIES.filter((q) => q.materials.includes(material));
}

/** Plain-English label for the material enum — UI tooltip + dropdown. */
export const QUARRY_MATERIAL_LABEL: Record<QuarryMaterial, string> = {
  CLASS_2_AB: 'Class 2 aggregate base',
  CLASS_3_AB: 'Class 3 aggregate base',
  CRUSHED_MISC_BASE: 'Crushed misc base (CMB)',
  CRUSHED_ROCK_FINISH: 'Top-course crushed rock (finish layer)',
  DRAIN_ROCK_34: '3/4" drain rock',
  DRAIN_ROCK_15: '1-1/2" drain rock',
  SAND_CONCRETE: 'Concrete sand',
  SAND_BEDDING: 'Bedding sand',
  RIPRAP_QUARTER_TON: 'Quarter-ton riprap',
  RIPRAP_HALF_TON: 'Half-ton riprap',
  RIPRAP_TWO_TON: '2-ton riprap',
  HMA_TYPE_A: 'Hot mix asphalt Type A',
  HMA_RHMA: 'RHMA (rubberized hot mix)',
  COLD_MIX: 'Cold-mix patch',
  PCC_READY_MIX: 'Portland concrete (ready-mix)',
  IMPORT_BORROW_FILL: 'Imported borrow / engineered fill',
};
