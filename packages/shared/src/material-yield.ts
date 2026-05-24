// Material yield + swell-factor math.
//
// Heavy-civil estimating constantly converts between three different
// volume states of the same material:
//
//   bank CY      — in-situ, undisturbed (what the cut sheet measures)
//   loose CY     — after excavation, before compaction (what a truck hauls)
//   compacted CY — placed and compacted in the fill (what the plans show)
//
// The conversion factor depends on the material. Native CA topsoil
// swells ~25% loose and shrinks ~10% compacted; AB compacts tighter
// than that. Without this helper, estimators eyeball the numbers and
// end up under/over on trucking + import.
//
// Pure function, no I/O. Tables come from CalTrans + USACE + the
// AGC heavy/highway estimating handbook. Each conversion returns a
// `note` so the bid review knows what factor was used.

/** Common heavy-civil materials with stable swell/shrink factors. */
export type MaterialKind =
  | 'NATIVE_SOIL'
  | 'AGGREGATE_BASE_CLASS_2'
  | 'AGGREGATE_BASE_CLASS_3'
  | 'DRAIN_ROCK_34'         // 3/4" drain rock
  | 'RIPRAP_QUARTER_TON'
  | 'HMA_TYPE_A'            // hot mix asphalt
  | 'PCC_STRUCTURAL'        // structural concrete
  | 'IMPORT_BORROW'         // generic imported fill
  | 'CRUSHED_MISC_BASE';

/** A volume in one of three states. */
export type VolumeState = 'bank' | 'loose' | 'compacted';

export interface VolumeInput {
  amountCY: number;
  state: VolumeState;
}

export interface VolumeConversion {
  /** Input echoed for traceability. */
  from: VolumeInput;
  /** Target state. */
  toState: VolumeState;
  /** Computed CY in the target state, rounded to 1 decimal. */
  amountCY: number;
  /** The multiplication factor used (from → to). E.g. for native soil
   *  bank → loose this is ~1.25. */
  factor: number;
  /** Short rationale ("native soil swells 25% loose per CalTrans
   *  earthwork tables") for the bid review tooltip. */
  note: string;
}

/** Per-material factors. Indexed [from][to]. Identity factor is 1.0
 *  on the diagonal. Values come from CalTrans + AGC handbook
 *  averages — caller can swap in project-specific factors via
 *  `convertVolume(..., overrideFactors)` if they have lab data. */
type FactorTable = Record<VolumeState, Record<VolumeState, number>>;

const FACTORS: Record<MaterialKind, FactorTable> = {
  // Native NorCal mineral soil (typical residual + colluvium mix).
  // Bank → loose +25%; bank → compacted -10% (placed engineered fill).
  NATIVE_SOIL: makeTable({ bankLoose: 1.25, bankCompacted: 0.9 }),
  // Class 2 AB compacts tightly; bank → loose +18% based on typical
  // pit run.
  AGGREGATE_BASE_CLASS_2: makeTable({ bankLoose: 1.18, bankCompacted: 0.95 }),
  // Class 3 AB sits between.
  AGGREGATE_BASE_CLASS_3: makeTable({ bankLoose: 1.20, bankCompacted: 0.93 }),
  // 3/4" drain rock — bought loose by the ton/yard from a supplier and
  // placed loose in trenches / French drains. There's no meaningful
  // "bank" state for an aggregate product, so all three states use
  // identity factors. Caller gets a no-op conversion but the helper
  // still returns the standard note so the bid review sees what it was.
  DRAIN_ROCK_34: makeTable({ bankLoose: 1.0, bankCompacted: 1.0 }),
  // Quarter-ton riprap — placed by lift, not compacted; volume
  // factor of 1.0 between loose + compacted.
  RIPRAP_QUARTER_TON: makeTable({ bankLoose: 1.0, bankCompacted: 1.0 }),
  // Hot mix asphalt — compacts significantly from loose to placed.
  // Bank doesn't really apply for HMA (no in-situ form) — we use
  // loose-state as the import truck state.
  HMA_TYPE_A: makeTable({ bankLoose: 1.0, bankCompacted: 0.85 }),
  // Structural PCC — placed wet; loose state is irrelevant. Use
  // the identity for unsupported conversions.
  PCC_STRUCTURAL: makeTable({ bankLoose: 1.0, bankCompacted: 1.0 }),
  // Generic import borrow.
  IMPORT_BORROW: makeTable({ bankLoose: 1.20, bankCompacted: 0.92 }),
  // Crushed Miscellaneous Base — recycled, similar to Class 2.
  CRUSHED_MISC_BASE: makeTable({ bankLoose: 1.22, bankCompacted: 0.94 }),
};

/** Plain-English explanation per material, used in the `note` field. */
const MATERIAL_NOTE: Record<MaterialKind, string> = {
  NATIVE_SOIL: 'native NorCal soil (CalTrans earthwork average)',
  AGGREGATE_BASE_CLASS_2: 'Class 2 AB, typical pit run',
  AGGREGATE_BASE_CLASS_3: 'Class 3 AB, typical pit run',
  DRAIN_ROCK_34: '3/4" drain rock — minimal compaction',
  RIPRAP_QUARTER_TON: 'quarter-ton riprap — placed by lift',
  HMA_TYPE_A: 'hot mix asphalt Type A — placed lift density',
  PCC_STRUCTURAL: 'structural concrete — pour volume identity',
  IMPORT_BORROW: 'imported borrow — generic engineered fill',
  CRUSHED_MISC_BASE: 'CMB recycled aggregate — Class 2-equivalent',
};

/** Build a 3x3 factor table from the two non-identity numbers. The
 *  third pair (loose ↔ compacted) is derived: compacted/loose = the
 *  compacted/bank ratio divided by the loose/bank ratio. */
function makeTable({
  bankLoose,
  bankCompacted,
}: {
  bankLoose: number;
  bankCompacted: number;
}): FactorTable {
  const looseCompacted = bankCompacted / bankLoose;
  return {
    bank: {
      bank: 1,
      loose: bankLoose,
      compacted: bankCompacted,
    },
    loose: {
      bank: 1 / bankLoose,
      loose: 1,
      compacted: looseCompacted,
    },
    compacted: {
      bank: 1 / bankCompacted,
      loose: 1 / looseCompacted,
      compacted: 1,
    },
  };
}

/** Round half-away-from-zero to 1 decimal place. The estimator only
 *  cares to 0.1 CY for the volumes we work with — finer than that
 *  is fake precision given the bank → loose factor uncertainty. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ConvertOptions {
  /** Override the per-material factor table when project-specific
   *  data exists (lab compaction test results, pit-specific swell
   *  measurements). When provided, replaces the defaults entirely. */
  overrideFactors?: Partial<FactorTable>;
}

/** Convert a volume from one state to another for a given material.
 *  Throws on unknown material so the caller can't silently use a
 *  generic factor when one wasn't intended. */
export function convertVolume(
  material: MaterialKind,
  input: VolumeInput,
  toState: VolumeState,
  options: ConvertOptions = {},
): VolumeConversion {
  const table = FACTORS[material];
  if (!table) {
    throw new Error(`convertVolume: unknown material ${material}`);
  }
  const baseRow = table[input.state];
  const row =
    options.overrideFactors && options.overrideFactors[input.state]
      ? { ...baseRow, ...options.overrideFactors[input.state] }
      : baseRow;
  const factor = row[toState];
  const amountCY = round1(input.amountCY * factor);
  const note = `${MATERIAL_NOTE[material]} — ${input.state}→${toState} ×${factor.toFixed(3)}`;
  return {
    from: input,
    toState,
    amountCY,
    factor,
    note,
  };
}

/** Helper: compute truck-loads needed for a bank-CY excavation
 *  hauled in 12-CY end-dumps. Returns whole loads, rounded UP. */
export function endDumpLoadsForExcavation(
  material: MaterialKind,
  bankCY: number,
  truckCapacityLooseCY = 12,
): number {
  const loose = convertVolume(
    material,
    { amountCY: bankCY, state: 'bank' },
    'loose',
  );
  if (truckCapacityLooseCY <= 0) {
    throw new Error('endDumpLoadsForExcavation: truckCapacityLooseCY must be > 0');
  }
  return Math.ceil(loose.amountCY / truckCapacityLooseCY);
}
