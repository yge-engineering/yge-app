// NorCal city + town centroids — the lookup table that turns "Cottonwood"
// or "Shasta County" into approximate lat/lng for trucking-cycle math.
//
// Coverage: the seven counties YGE primarily bids in (Shasta, Tehama,
// Trinity, Siskiyou, Butte, Glenn, Lassen) plus the Sacramento Valley
// corridor down to Yuba City + a handful of Bay Area / Sierra towns
// that come up on occasional jobs.
//
// Coordinates are approximate town-center reference points (~1-mile
// accuracy is fine — quarry haul math doesn't need GPS precision).
// Pure data + helpers, no I/O.

export interface NorcalCity {
  /** Plain town/city name. */
  name: string;
  /** US state — almost always CA; OR included for Klamath Falls
   *  corridor. */
  state: 'CA' | 'OR' | 'NV';
  /** County name (no "County" suffix). */
  county: string;
  /** Decimal degrees. */
  lat: number;
  lng: number;
}

/** YGE's primary service area + spill-over. Caller can grep by
 *  county to drive a "jobs by county" report later. */
export const NORCAL_CITIES: NorcalCity[] = [
  // --- Shasta County (home) ---
  { name: 'Cottonwood', state: 'CA', county: 'Shasta', lat: 40.385, lng: -122.281 },
  { name: 'Redding', state: 'CA', county: 'Shasta', lat: 40.5865, lng: -122.3917 },
  { name: 'Anderson', state: 'CA', county: 'Shasta', lat: 40.4482, lng: -122.2978 },
  { name: 'Shasta Lake', state: 'CA', county: 'Shasta', lat: 40.6804, lng: -122.3706 },
  { name: 'Burney', state: 'CA', county: 'Shasta', lat: 40.8821, lng: -121.6608 },
  { name: 'Palo Cedro', state: 'CA', county: 'Shasta', lat: 40.5648, lng: -122.2358 },
  { name: 'Shingletown', state: 'CA', county: 'Shasta', lat: 40.4929, lng: -121.8888 },
  // --- Tehama County ---
  { name: 'Red Bluff', state: 'CA', county: 'Tehama', lat: 40.1785, lng: -122.2358 },
  { name: 'Corning', state: 'CA', county: 'Tehama', lat: 39.9277, lng: -122.1791 },
  { name: 'Los Molinos', state: 'CA', county: 'Tehama', lat: 40.0224, lng: -122.0944 },
  { name: 'Tehama', state: 'CA', county: 'Tehama', lat: 40.0277, lng: -122.1244 },
  { name: 'Mineral', state: 'CA', county: 'Tehama', lat: 40.3457, lng: -121.6088 },
  // --- Trinity County ---
  { name: 'Weaverville', state: 'CA', county: 'Trinity', lat: 40.7307, lng: -122.9417 },
  { name: 'Hayfork', state: 'CA', county: 'Trinity', lat: 40.5557, lng: -123.1825 },
  { name: 'Lewiston', state: 'CA', county: 'Trinity', lat: 40.7104, lng: -122.7964 },
  // --- Siskiyou County ---
  { name: 'Yreka', state: 'CA', county: 'Siskiyou', lat: 41.7354, lng: -122.6345 },
  { name: 'Mount Shasta', state: 'CA', county: 'Siskiyou', lat: 41.3098, lng: -122.3106 },
  { name: 'Weed', state: 'CA', county: 'Siskiyou', lat: 41.4226, lng: -122.3858 },
  { name: 'Dunsmuir', state: 'CA', county: 'Siskiyou', lat: 41.2082, lng: -122.2716 },
  { name: 'Tulelake', state: 'CA', county: 'Siskiyou', lat: 41.9555, lng: -121.4767 },
  { name: 'Etna', state: 'CA', county: 'Siskiyou', lat: 41.4571, lng: -122.8942 },
  // --- Butte County ---
  { name: 'Chico', state: 'CA', county: 'Butte', lat: 39.7285, lng: -121.8375 },
  { name: 'Oroville', state: 'CA', county: 'Butte', lat: 39.5138, lng: -121.5566 },
  { name: 'Paradise', state: 'CA', county: 'Butte', lat: 39.7596, lng: -121.6219 },
  { name: 'Gridley', state: 'CA', county: 'Butte', lat: 39.3638, lng: -121.6938 },
  { name: 'Magalia', state: 'CA', county: 'Butte', lat: 39.8121, lng: -121.5774 },
  // --- Glenn County ---
  { name: 'Willows', state: 'CA', county: 'Glenn', lat: 39.5243, lng: -122.1936 },
  { name: 'Orland', state: 'CA', county: 'Glenn', lat: 39.7474, lng: -122.1964 },
  // --- Lassen County ---
  { name: 'Susanville', state: 'CA', county: 'Lassen', lat: 40.4163, lng: -120.6531 },
  { name: 'Westwood', state: 'CA', county: 'Lassen', lat: 40.3035, lng: -121.0027 },
  // --- Sacramento Valley spill-over ---
  { name: 'Yuba City', state: 'CA', county: 'Sutter', lat: 39.1404, lng: -121.6169 },
  { name: 'Marysville', state: 'CA', county: 'Yuba', lat: 39.1457, lng: -121.5914 },
  { name: 'Colusa', state: 'CA', county: 'Colusa', lat: 39.2143, lng: -122.0094 },
  { name: 'Williams', state: 'CA', county: 'Colusa', lat: 39.1546, lng: -122.1494 },
  { name: 'Sacramento', state: 'CA', county: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  { name: 'Roseville', state: 'CA', county: 'Placer', lat: 38.7521, lng: -121.2880 },
  { name: 'Auburn', state: 'CA', county: 'Placer', lat: 38.8966, lng: -121.0769 },
  // --- Northeast California / Modoc ---
  { name: 'Alturas', state: 'CA', county: 'Modoc', lat: 41.4871, lng: -120.5425 },
  { name: 'Adin', state: 'CA', county: 'Modoc', lat: 41.1907, lng: -120.9494 },
  // --- Klamath Basin / OR fringe (CAL FIRE + USFS jobs sometimes spill) ---
  { name: 'Klamath Falls', state: 'OR', county: 'Klamath', lat: 42.2249, lng: -121.7817 },
];

/** Normalize a name for matching — lowercase, collapse whitespace,
 *  strip "City of " / "Town of " prefixes, trim. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(city of|town of)\s+/, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Look up a city by name (case-insensitive, tolerant of "City of"
 *  prefixes). When `county` is supplied it tightens the match — a
 *  Cottonwood in Shasta County is different from a Cottonwood in some
 *  other state. Returns undefined when nothing matches. */
export function findCity(name: string, county?: string): NorcalCity | undefined {
  if (!name) return undefined;
  const target = normalize(name);
  const countyTarget = county ? normalize(county).replace(/\s+county$/, '') : null;
  // Try exact-name + county-match first.
  if (countyTarget) {
    const exact = NORCAL_CITIES.find(
      (c) => normalize(c.name) === target && normalize(c.county) === countyTarget,
    );
    if (exact) return exact;
  }
  // Then exact name only.
  const byName = NORCAL_CITIES.find((c) => normalize(c.name) === target);
  if (byName) return byName;
  // Then substring (e.g. "Redding, CA" matches Redding).
  return NORCAL_CITIES.find((c) => target.includes(normalize(c.name)));
}

/** Look up a county centroid when only the county is known.
 *  Returns the centroid of the county-seat city. */
export function findCountyCentroid(county: string): NorcalCity | undefined {
  const target = normalize(county).replace(/\s+county$/, '');
  // County seats — first-listed city in each county above tends to be
  // the seat or major city; just match on county.
  const sameCounty = NORCAL_CITIES.filter(
    (c) => normalize(c.county) === target,
  );
  if (sameCounty.length === 0) return undefined;
  // Prefer the named county seat for the YGE service-area counties.
  const seats: Record<string, string> = {
    shasta: 'redding',
    tehama: 'red bluff',
    trinity: 'weaverville',
    siskiyou: 'yreka',
    butte: 'oroville',
    glenn: 'willows',
    lassen: 'susanville',
    modoc: 'alturas',
    sutter: 'yuba city',
    yuba: 'marysville',
    colusa: 'colusa',
    sacramento: 'sacramento',
    placer: 'auburn',
  };
  const seat = seats[target];
  if (seat) {
    const match = sameCounty.find((c) => normalize(c.name) === seat);
    if (match) return match;
  }
  return sameCounty[0];
}
