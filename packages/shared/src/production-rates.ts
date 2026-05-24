// Heavy-civil production rates — the anchor numbers the AI uses to
// derive schedule from quantity × rate × site-condition multiplier.
//
// Plain English: a crew can place ~300 CY of structural fill per day
// under normal conditions. If the site is LIVE (energized substation,
// active roadway with traffic control), apply the LIVE multiplier —
// real-world production drops by 30–60% because of clearance,
// outage windows, flagger coordination, etc.
//
// Numbers are NorCal heavy-civil typicals from YGE experience + AGC
// handbook ranges. Per-job actuals will vary; these are starting
// anchors so the AI does not pull schedule estimates from thin air.

/** Site condition the AI determined from the plans. */
export type SiteCondition = 'LIVE' | 'GREENFIELD' | 'PARTIAL_LIVE' | 'UNKNOWN';

/** A single production-rate entry. The AI uses this to translate
 *  a bid quantity into crew-days, then sums critical-path items into
 *  a calendar duration. */
export interface ProductionRate {
  /** Stable id for the UI / lookups. */
  id: string;
  /** Plain-English category tag. */
  category:
    | 'EARTHWORK'
    | 'UTILITY'
    | 'CONCRETE'
    | 'FENCE'
    | 'PAVING'
    | 'STRIPING'
    | 'EROSION_CONTROL'
    | 'CLEARING'
    | 'OTHER';
  /** Plain-English description. */
  task: string;
  /** Unit the rate is expressed in. */
  unit: string;
  /** Typical low end of the per-crew-day rate (conservative). */
  perCrewDayLow: number;
  /** Typical high end of the per-crew-day rate (productive day). */
  perCrewDayHigh: number;
  /** Crew size assumed for this rate (people). */
  crewSize: number;
  /** Notes about what shifts the rate up or down. */
  note?: string;
}

/** Default rate library. Caller can extend with company-specific
 *  rates by passing their own array to deriveScheduleDays. */
export const DEFAULT_PRODUCTION_RATES: ProductionRate[] = [
  // --- Earthwork ---
  {
    id: 'scrape-strip-topsoil',
    category: 'EARTHWORK',
    task: 'Scrape / strip topsoil + stockpile',
    unit: 'CY',
    perCrewDayLow: 600,
    perCrewDayHigh: 1200,
    crewSize: 3,
    note: 'Dozer + loader + grade-checker. Low end on small lots; high end on wide-open sites.',
  },
  {
    id: 'mass-excavation',
    category: 'EARTHWORK',
    task: 'Mass excavation (load + haul to on-site stockpile)',
    unit: 'CY',
    perCrewDayLow: 400,
    perCrewDayHigh: 1500,
    crewSize: 4,
    note: 'Excavator + 2 articulated trucks + grade-checker. Drops to low end on tight access.',
  },
  {
    id: 'import-fill-haul',
    category: 'EARTHWORK',
    task: 'Imported fill — haul + place + compact',
    unit: 'CY',
    perCrewDayLow: 250,
    perCrewDayHigh: 600,
    crewSize: 5,
    note: 'Limited by haul cycle distance + truck availability. Long hauls drop into the low end fast.',
  },
  {
    id: 'structural-fill-95pct',
    category: 'EARTHWORK',
    task: 'Structural fill, 95% compaction (6-inch lifts)',
    unit: 'CY',
    perCrewDayLow: 200,
    perCrewDayHigh: 400,
    crewSize: 4,
    note: 'Sheepsfoot or smooth-drum on each 6-inch lift, with QC density testing.',
  },
  {
    id: 'fine-grade-subgrade',
    category: 'EARTHWORK',
    task: 'Fine grade subgrade to plan',
    unit: 'SF',
    perCrewDayLow: 8_000,
    perCrewDayHigh: 20_000,
    crewSize: 3,
    note: 'Motor grader + roller. Tight tolerances on substation pads drop into the low end.',
  },
  {
    id: 'aggregate-base-place',
    category: 'EARTHWORK',
    task: 'Class 2 aggregate base — place + compact',
    unit: 'TON',
    perCrewDayLow: 250,
    perCrewDayHigh: 700,
    crewSize: 4,
    note: 'Spreader + roller + water truck. Larger pads = higher rate.',
  },

  // --- Utility / electrical / drainage ---
  {
    id: 'conduit-trench-pull',
    category: 'UTILITY',
    task: 'PVC conduit trench, lay, backfill (2–4" duct)',
    unit: 'LF',
    perCrewDayLow: 150,
    perCrewDayHigh: 400,
    crewSize: 4,
    note: 'Trencher / excavator + 2 laborers + grade-checker. Multi-conduit ductbanks slow the rate.',
  },
  {
    id: 'conduit-encased-concrete',
    category: 'UTILITY',
    task: 'Concrete-encased duct bank',
    unit: 'LF',
    perCrewDayLow: 60,
    perCrewDayHigh: 200,
    crewSize: 5,
    note: 'Trench + duct + chair + flowable fill or 2-sack slurry. Inspection-heavy.',
  },
  {
    id: 'ground-rod-install',
    category: 'UTILITY',
    task: 'Ground rod install + cad-weld to ground grid',
    unit: 'EA',
    perCrewDayLow: 8,
    perCrewDayHigh: 25,
    crewSize: 3,
    note: 'Driver + ground crew. Hard ground or shallow rock slows it dramatically.',
  },
  {
    id: 'ground-grid-wire',
    category: 'UTILITY',
    task: 'Ground grid bare copper, trench + lay',
    unit: 'LF',
    perCrewDayLow: 200,
    perCrewDayHigh: 800,
    crewSize: 3,
    note: 'Inside the substation yard. Tied to ground rods at intersections.',
  },
  {
    id: 'storm-drain-pipe',
    category: 'UTILITY',
    task: 'Storm drain pipe install (12-24" RCP / HDPE)',
    unit: 'LF',
    perCrewDayLow: 80,
    perCrewDayHigh: 250,
    crewSize: 5,
    note: 'Excavation + bedding + pipe + backfill + density. Depth matters most.',
  },
  {
    id: 'manhole-vault-install',
    category: 'UTILITY',
    task: 'Precast manhole / vault install',
    unit: 'EA',
    perCrewDayLow: 1,
    perCrewDayHigh: 3,
    crewSize: 5,
    note: 'Excavate + bed + set + grout + backfill. One per day is typical for deep vaults.',
  },

  // --- Concrete ---
  {
    id: 'equipment-foundation-pour',
    category: 'CONCRETE',
    task: 'Equipment foundation (form + rebar + pour)',
    unit: 'CY',
    perCrewDayLow: 15,
    perCrewDayHigh: 40,
    crewSize: 6,
    note: 'Per-CY rate is misleading for foundations — bigger driver is # of separate foundations.',
  },
  {
    id: 'oil-containment-berm',
    category: 'CONCRETE',
    task: 'Oil-containment berm + liner',
    unit: 'SF',
    perCrewDayLow: 200,
    perCrewDayHigh: 500,
    crewSize: 4,
    note: 'Containment-grade liner + concrete curb. Substation-specific.',
  },
  {
    id: 'flatwork-pour-finish',
    category: 'CONCRETE',
    task: 'Sidewalk / pad flatwork — form, pour, finish',
    unit: 'SF',
    perCrewDayLow: 400,
    perCrewDayHigh: 1500,
    crewSize: 5,
    note: 'Smaller pads + tight tolerances → low end.',
  },

  // --- Fence + finish ---
  {
    id: 'chain-link-fence-install',
    category: 'FENCE',
    task: 'Chain-link security fence (8-ft + barbed wire)',
    unit: 'LF',
    perCrewDayLow: 150,
    perCrewDayHigh: 400,
    crewSize: 3,
    note: 'Includes posts, mesh, top rail, fabric tie. Add a day for swing gates.',
  },
  {
    id: 'gravel-yard-surfacing',
    category: 'EARTHWORK',
    task: 'Substation yard rock / road base finish',
    unit: 'TON',
    perCrewDayLow: 300,
    perCrewDayHigh: 800,
    crewSize: 4,
    note: 'Spread + dress + roll. Large yards = higher rate.',
  },

  // --- Paving ---
  {
    id: 'ac-paving-place',
    category: 'PAVING',
    task: 'AC paving place + compact (2-3" lift)',
    unit: 'TON',
    perCrewDayLow: 500,
    perCrewDayHigh: 1500,
    crewSize: 8,
    note: 'Paver + 2 rollers + crew. Weather-window dependent.',
  },
  {
    id: 'striping-thermo-4in',
    category: 'STRIPING',
    task: 'Thermoplastic stripe, 4-inch wide',
    unit: 'LF',
    perCrewDayLow: 4_000,
    perCrewDayHigh: 12_000,
    crewSize: 3,
    note: 'Truck-mounted plant. Detours + traffic control cut into the rate.',
  },

  // --- Clearing + erosion ---
  {
    id: 'clearing-grubbing',
    category: 'CLEARING',
    task: 'Clearing + grubbing (light brush, small trees)',
    unit: 'ACRE',
    perCrewDayLow: 1,
    perCrewDayHigh: 4,
    crewSize: 4,
    note: 'Masticator + chipper. Larger timber drops the rate hard.',
  },
  {
    id: 'silt-fence-install',
    category: 'EROSION_CONTROL',
    task: 'Silt fence install',
    unit: 'LF',
    perCrewDayLow: 800,
    perCrewDayHigh: 2_500,
    crewSize: 3,
    note: 'Trench, fabric, stakes, backfill. Easy in soft ground.',
  },
];

/** Per-site-condition multiplier applied to active construction days.
 *  GREENFIELD work runs at the published rates; LIVE work near
 *  energized equipment is 50–80% slower because of clearance, outage
 *  windows, flagger coordination, lockout/tagout, and stop-work for
 *  utility crews. PARTIAL_LIVE is in between (some scope live, rest
 *  greenfield). */
export const SITE_CONDITION_MULTIPLIER: Record<SiteCondition, number> = {
  GREENFIELD: 1.0,
  PARTIAL_LIVE: 1.35,
  LIVE: 1.7,
  UNKNOWN: 1.35, // assume worst-of-two-evils when unknown
};

/** Plain-English explanation per site condition for the UI tooltip. */
export const SITE_CONDITION_NOTE: Record<SiteCondition, string> = {
  GREENFIELD:
    'New site — no energized equipment / live traffic to work around. Crews work at normal production rates.',
  PARTIAL_LIVE:
    'Some scope adjacent to energized / occupied area; rest is open. Production drops ~35% on the live-adjacent work.',
  LIVE:
    'Working in / next to energized substation, occupied building, or live traffic. Production drops ~70% on the live work because of clearance, outage windows, LOTO, agency coordination.',
  UNKNOWN:
    'AI could not determine site condition from the plans. Verify with the owner BEFORE bidding — the wrong assumption here can cost months of schedule.',
};

export interface RateLookupKey {
  /** Bid item description — matched against the rate library
   *  loosely by keyword. */
  description: string;
  /** Bid item unit — must match the rate's unit. */
  unit: string;
}

/** Look up the best-matching rate for a bid-item description+unit.
 *  Returns undefined when no rate matches. Used by the AI prompt
 *  (rendered into the prompt body) and by the UI to show "what rate
 *  is being assumed for this line". Match is naive substring on
 *  lowercased task; caller can supply their own rate library to
 *  augment. */
export function findBestRate(
  key: RateLookupKey,
  library: ProductionRate[] = DEFAULT_PRODUCTION_RATES,
): ProductionRate | undefined {
  const desc = key.description.toLowerCase();
  // Filter by matching unit first.
  const candidates = library.filter((r) => r.unit === key.unit);
  if (candidates.length === 0) return undefined;
  // Find the rate whose task tokens have the highest overlap with the
  // description. Simple word-overlap scoring is enough for the
  // anchor-rate use case.
  const descWords = new Set(desc.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  let best: { rate: ProductionRate; score: number } | null = null;
  for (const rate of candidates) {
    const taskWords = rate.task.toLowerCase().split(/[^a-z0-9]+/);
    let score = 0;
    for (const w of taskWords) {
      if (w.length > 3 && descWords.has(w)) score += 1;
    }
    if (!best || score > best.score) {
      best = { rate, score };
    }
  }
  // Require at least one shared word to count as a match.
  return best && best.score > 0 ? best.rate : undefined;
}

/** Apply a site-condition multiplier to a raw crew-day count. */
export function applySiteConditionMultiplier(
  crewDays: number,
  condition: SiteCondition,
): number {
  return crewDays * SITE_CONDITION_MULTIPLIER[condition];
}

/** Compute crew-days for a single bid-item quantity using a rate.
 *  Uses the midpoint of low/high. Returns Infinity (signaling "rate
 *  doesn't apply") if quantity is 0 or rate has zero range. */
export function crewDaysForQuantity(
  quantity: number,
  rate: ProductionRate,
): number {
  if (quantity <= 0) return 0;
  const mid = (rate.perCrewDayLow + rate.perCrewDayHigh) / 2;
  if (mid <= 0) return Number.POSITIVE_INFINITY;
  return quantity / mid;
}
