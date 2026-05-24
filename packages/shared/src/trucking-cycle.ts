// Trucking-cycle math — given a quarry and a job site, compute the
// per-load round-trip time and the per-CY/TON haul cost.
//
// Plain English: a truck loaded at Knife River Redding has to drive
// to the job (say 28 miles), dump, drive back, queue at the loader,
// load, and repeat. If the cycle is 75 minutes and the truck is on
// the clock at $150/hour, that's $187 per load. At 14 CY per
// end-dump that's ~$13.40/CY just in trucking — and most estimators
// either miss the trucking entirely or guess it at $5/CY because
// "trucking is cheap." On a 5,000-CY import job the gap is $40K.

import { findCity, findCountyCentroid, type NorcalCity } from './norcal-cities';
import {
  NORCAL_QUARRIES,
  quarriesForMaterial,
  QUARRY_MATERIAL_LABEL,
  type NorcalQuarry,
  type QuarryMaterial,
} from './norcal-quarries';

/** Decimal degrees → great-circle distance in miles (haversine).
 *  Accurate to ~0.5 mi at NorCal latitudes — more than enough for
 *  haul math where the road distance is going to add a 1.2–1.3×
 *  multiplier anyway. */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/** Straight-line miles overcount free movement and undercount real
 *  road routing through mountain passes. 1.25× is a defensible NorCal
 *  midpoint (flat-valley jobs run lower; mountain jobs run higher). */
const ROAD_DISTANCE_MULTIPLIER = 1.25;

export function estimatedRoadMiles(straightLineMiles: number): number {
  return straightLineMiles * ROAD_DISTANCE_MULTIPLIER;
}

/** Truck-cycle parameters. Defaults match a typical NorCal end-dump
 *  haul; caller can pass project-specific overrides. */
export interface CycleParams {
  /** One-way road miles from quarry to job. */
  oneWayMiles: number;
  /** Average loaded driving speed (mph). Defaults to 45 — heavier
   *  trucks lose 5–10 mph vs empty. */
  loadedSpeedMph?: number;
  /** Average empty return speed (mph). Defaults to 50. */
  emptySpeedMph?: number;
  /** Minutes per load at the quarry (queue + scale + load). */
  loadMinutes?: number;
  /** Minutes to dump on site (positioning + dump + clear). */
  dumpMinutes?: number;
  /** Optional queue / turn-around adder on top of the dump time —
   *  shows up on tight sites with a single dump area + multiple
   *  trucks. */
  queueMinutes?: number;
}

export interface CycleResult {
  /** Total minutes for one round trip = drive out + load + drive
   *  back + dump + queue. */
  cycleMinutes: number;
  /** How the cycle breaks down (for the tooltip). */
  breakdown: {
    loadMin: number;
    driveOutMin: number;
    dumpMin: number;
    driveBackMin: number;
    queueMin: number;
  };
}

export function cycleMinutes(params: CycleParams): CycleResult {
  const loadedSpeed = params.loadedSpeedMph ?? 45;
  const emptySpeed = params.emptySpeedMph ?? 50;
  const loadMin = params.loadMinutes ?? 15;
  const dumpMin = params.dumpMinutes ?? 5;
  const queueMin = params.queueMinutes ?? 10;
  const driveOutMin = (params.oneWayMiles / loadedSpeed) * 60;
  const driveBackMin = (params.oneWayMiles / emptySpeed) * 60;
  return {
    cycleMinutes: loadMin + driveOutMin + dumpMin + driveBackMin + queueMin,
    breakdown: {
      loadMin,
      driveOutMin: Math.round(driveOutMin * 10) / 10,
      dumpMin,
      driveBackMin: Math.round(driveBackMin * 10) / 10,
      queueMin,
    },
  };
}

/** Per-load and per-unit haul cost in cents. The truck rate is the
 *  YGE/sub bill rate — typical NorCal end-dump is $150–180/hour all
 *  in (operator + diesel + maintenance + insurance + truck recovery).
 *  Default $165/hour. */
export interface HaulCostParams {
  cycleMinutes: number;
  /** Truck rate in cents per hour. */
  hourlyRateCents?: number;
  /** Truck capacity in the unit (typically 14 CY or 22 TON). */
  capacityPerLoad: number;
}

export interface HaulCostResult {
  costPerLoadCents: number;
  costPerUnitCents: number;
  loadsForQuantity: (quantity: number) => number;
  totalCostForQuantityCents: (quantity: number) => number;
}

export function haulCost(params: HaulCostParams): HaulCostResult {
  const rate = params.hourlyRateCents ?? 165_00;
  const hours = params.cycleMinutes / 60;
  const costPerLoadCents = Math.round(rate * hours);
  const costPerUnitCents = Math.round(costPerLoadCents / params.capacityPerLoad);
  return {
    costPerLoadCents,
    costPerUnitCents,
    loadsForQuantity: (quantity) => Math.ceil(quantity / params.capacityPerLoad),
    totalCostForQuantityCents: (quantity) =>
      Math.ceil(quantity / params.capacityPerLoad) * costPerLoadCents,
  };
}

/** Geocode a job site from the structured fields we extract from
 *  plans. lat/lng wins when present; otherwise city + county; then
 *  county alone. Returns null when nothing matches. */
export interface GeocodeJobInput {
  lat?: number;
  lng?: number;
  city?: string;
  county?: string;
}

export interface GeocodeJobResult {
  lat: number;
  lng: number;
  /** What we matched on — UI tooltip can show "matched via city
   *  centroid for Cottonwood, Shasta County". */
  source:
    | 'explicit-coordinates'
    | 'city-match'
    | 'county-centroid'
    | 'no-match';
  matchedCity?: NorcalCity;
}

export function geocodeJobSite(input: GeocodeJobInput): GeocodeJobResult | null {
  if (input.lat != null && input.lng != null) {
    return {
      lat: input.lat,
      lng: input.lng,
      source: 'explicit-coordinates',
    };
  }
  if (input.city) {
    const city = findCity(input.city, input.county);
    if (city) {
      return {
        lat: city.lat,
        lng: city.lng,
        source: 'city-match',
        matchedCity: city,
      };
    }
  }
  if (input.county) {
    const county = findCountyCentroid(input.county);
    if (county) {
      return {
        lat: county.lat,
        lng: county.lng,
        source: 'county-centroid',
        matchedCity: county,
      };
    }
  }
  return null;
}

/** Rank quarries by straight-line distance to the job for a given
 *  material. Returns the top N (default 5) with distance + cycle
 *  + per-CY/TON haul cost computed. */
export interface NearestQuarriesInput {
  jobLat: number;
  jobLng: number;
  material: QuarryMaterial;
  /** Truck capacity. CY for AB/drain rock; TON for HMA / asphalt;
   *  CY-equivalent for borrow. Default 14 (end-dump CY). */
  capacityPerLoad?: number;
  hourlyRateCents?: number;
  maxResults?: number;
}

export interface QuarryHaulOption {
  quarry: NorcalQuarry;
  straightLineMiles: number;
  roadMiles: number;
  cycle: CycleResult;
  cost: HaulCostResult;
}

export function nearestQuarriesWithHaul(
  input: NearestQuarriesInput,
): QuarryHaulOption[] {
  const candidates = quarriesForMaterial(input.material);
  if (candidates.length === 0) return [];
  const max = input.maxResults ?? 5;
  const capacityPerLoad = input.capacityPerLoad ?? 14;
  const ranked: QuarryHaulOption[] = candidates
    .map((q) => {
      const straight = haversineMiles(
        { lat: input.jobLat, lng: input.jobLng },
        { lat: q.lat, lng: q.lng },
      );
      const road = estimatedRoadMiles(straight);
      const cycle = cycleMinutes({ oneWayMiles: road });
      const cost = haulCost({
        cycleMinutes: cycle.cycleMinutes,
        hourlyRateCents: input.hourlyRateCents,
        capacityPerLoad,
      });
      return {
        quarry: q,
        straightLineMiles: Math.round(straight * 10) / 10,
        roadMiles: Math.round(road * 10) / 10,
        cycle,
        cost,
      };
    })
    .sort((a, b) => a.roadMiles - b.roadMiles);
  return ranked.slice(0, max);
}

/** Re-export for UI use. */
export { QUARRY_MATERIAL_LABEL };

/** Guess which QuarryMaterial a bid-item description / unit pair
 *  needs. Returns null when nothing matches — caller can fall back
 *  to "haul cost unknown" rather than guess wrong. Pure regex; no
 *  AI. */
export function inferQuarryMaterial(
  description: string,
  unit: string,
): QuarryMaterial | null {
  const d = description.toLowerCase();
  // PCC / concrete first — flatwork descriptions often contain
  // "concrete" + "sand" which can match SAND_CONCRETE wrongly.
  if (/\bready[- ]?mix|\bpcc\b|portland cement concrete/.test(d)) {
    return 'PCC_READY_MIX';
  }
  if (/rhma|rubberized/.test(d)) return 'HMA_RHMA';
  if (/\bhma\b|asphalt|hot mix|ac pav/.test(d)) return 'HMA_TYPE_A';
  if (/cold[- ]?mix/.test(d)) return 'COLD_MIX';
  if (/class 2 ab|class ii ab|class 2 aggregate|class ii aggregate/.test(d)) {
    return 'CLASS_2_AB';
  }
  if (/class 3 ab|class iii ab|class 3 aggregate|class iii aggregate/.test(d)) {
    return 'CLASS_3_AB';
  }
  if (/crushed misc|cmb|crushed.*base/.test(d)) return 'CRUSHED_MISC_BASE';
  if (/drain.*rock|drainrock|gravel.*drain/.test(d)) {
    return /1[- ]?1\/2|1\.5|11\/2/.test(d) ? 'DRAIN_ROCK_15' : 'DRAIN_ROCK_34';
  }
  if (/quarter[- ]?ton|1\/4[- ]?ton.*riprap|riprap.*quarter/.test(d)) {
    return 'RIPRAP_QUARTER_TON';
  }
  if (/half[- ]?ton.*riprap|riprap.*half/.test(d)) {
    return 'RIPRAP_HALF_TON';
  }
  if (/2[- ]?ton.*riprap|riprap.*2[- ]?ton/.test(d)) {
    return 'RIPRAP_TWO_TON';
  }
  if (/bedding sand/.test(d)) return 'SAND_BEDDING';
  if (/sand/.test(d) && unit === 'CY') return 'SAND_CONCRETE';
  if (/import|borrow|engineered fill|structural fill/.test(d)) {
    return 'IMPORT_BORROW_FILL';
  }
  return null;
}
