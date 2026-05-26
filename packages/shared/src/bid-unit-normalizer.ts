// Bid unit normalizer.
//
// Bid items come in with wildly inconsistent units: "Tons", "TON",
// "tn", "ton.", "T", "tonne" — and "LF" / "Lin Ft" / "linear feet"
// / "lin. ft." / "ft" — and so on. Downstream code (rate-book
// matching, comparables scoring, CSV export, AI prompt context)
// works much better when units are normalized to a canonical
// short form.
//
// This module is the single source of truth for the canonical
// form per measurement type. Add new aliases here when the AI or
// an estimator types a new variation.
//
// Returns the original input verbatim when no mapping is known —
// callers don't need to handle "unknown unit" specially.

/** Canonical short forms YGE uses on bid forms and in the rate
 *  book. Stick to ≤3 chars per CA Standard Specifications. */
export type CanonicalUnit =
  | 'EA'    // each
  | 'LS'    // lump sum
  | 'LF'    // linear feet
  | 'SF'    // square feet
  | 'SY'    // square yard
  | 'CY'    // cubic yard
  | 'TON'   // ton (US short)
  | 'CWT'   // hundredweight (occasionally for steel)
  | 'GAL'   // gallon
  | 'HR'    // hour
  | 'DAY'   // day
  | 'MO'    // month
  | 'MI';   // mile

/** Alias → canonical map. All keys are lowercased + trimmed before
 *  lookup, so add aliases in any case here. Order doesn't matter. */
const ALIAS_TO_CANONICAL: Record<string, CanonicalUnit> = {
  // EA — each
  ea: 'EA',
  each: 'EA',
  'ea.': 'EA',
  unit: 'EA',
  units: 'EA',

  // LS — lump sum
  ls: 'LS',
  'l.s.': 'LS',
  lump: 'LS',
  'lump sum': 'LS',

  // LF — linear feet
  lf: 'LF',
  'l.f.': 'LF',
  linft: 'LF',
  'lin ft': 'LF',
  'lin. ft.': 'LF',
  'linear ft': 'LF',
  'linear feet': 'LF',
  ft: 'LF',
  feet: 'LF',
  "'": 'LF',

  // SF — square feet
  sf: 'SF',
  's.f.': 'SF',
  sqft: 'SF',
  'sq ft': 'SF',
  'sq. ft.': 'SF',
  'square ft': 'SF',
  'square feet': 'SF',

  // SY — square yard
  sy: 'SY',
  's.y.': 'SY',
  sqyd: 'SY',
  'sq yd': 'SY',
  'sq. yd.': 'SY',
  'square yd': 'SY',
  'square yards': 'SY',

  // CY — cubic yard
  cy: 'CY',
  'c.y.': 'CY',
  cuyd: 'CY',
  'cu yd': 'CY',
  'cu. yd.': 'CY',
  'cubic yd': 'CY',
  'cubic yards': 'CY',

  // TON
  ton: 'TON',
  tons: 'TON',
  tn: 'TON',
  't': 'TON',
  'ton.': 'TON',
  tonne: 'TON',  // we treat metric tonne as TON; the bid form will
                 //   want US short anyway, and the difference is
                 //   ~10% so this is a documented liberty.

  // CWT — hundredweight (rebar, occasionally)
  cwt: 'CWT',
  'c.w.t.': 'CWT',
  hundredweight: 'CWT',

  // GAL — gallon
  gal: 'GAL',
  'gal.': 'GAL',
  gallon: 'GAL',
  gallons: 'GAL',

  // HR — hour
  hr: 'HR',
  hrs: 'HR',
  hour: 'HR',
  hours: 'HR',
  'hr.': 'HR',

  // DAY
  day: 'DAY',
  days: 'DAY',
  'd.': 'DAY',

  // MO — month
  mo: 'MO',
  month: 'MO',
  months: 'MO',
  'mo.': 'MO',

  // MI — mile
  mi: 'MI',
  mile: 'MI',
  miles: 'MI',
  'mi.': 'MI',
};

/** Normalize a unit string to its canonical form. Returns the
 *  original string (trimmed) when no mapping is known, so callers
 *  can pass non-standard units through unchanged. */
export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const key = trimmed.toLowerCase();
  return ALIAS_TO_CANONICAL[key] ?? trimmed.toUpperCase();
}

/** Like normalizeUnit but only returns when the input is a known
 *  canonical alias. Returns null otherwise. Use this when "unknown
 *  unit" should be handled explicitly. */
export function tryCanonicalizeUnit(raw: string): CanonicalUnit | null {
  const key = raw.trim().toLowerCase();
  return ALIAS_TO_CANONICAL[key] ?? null;
}

/** All canonical units, in their typical order on a bid form. */
export const CANONICAL_UNITS: ReadonlyArray<CanonicalUnit> = [
  'EA',
  'LS',
  'LF',
  'SF',
  'SY',
  'CY',
  'TON',
  'CWT',
  'GAL',
  'HR',
  'DAY',
  'MO',
  'MI',
];
