// Rate math — labor, equipment, and prevailing-wage logic.
//
// Core formula for a labor cost line:
//   extendedCents = baseCents × quantity × otMultiplier
// where baseCents is chosen from the rate record based on the Job's rateType.
//
// Burden (payroll taxes + WC + GL + tools) is already baked into the stored
// base cents for each labor classification — the Excel model does the same.

import type { Cents } from './money';

export type RateType = 'PRIVATE' | 'PW' | 'DB' | 'IBEW';

export interface LaborBaseRates {
  baseCentsPrivate: Cents;
  baseCentsPW: Cents;
  baseCentsDB: Cents;
  baseCentsIBEW?: Cents | null;
}

export function pickLaborBase(rates: LaborBaseRates, type: RateType): Cents {
  switch (type) {
    case 'PRIVATE':
      return rates.baseCentsPrivate;
    case 'PW':
      return rates.baseCentsPW;
    case 'DB':
      return rates.baseCentsDB;
    case 'IBEW':
      if (rates.baseCentsIBEW == null) {
        throw new Error('No IBEW rate defined for this classification');
      }
      return rates.baseCentsIBEW;
  }
}

export function extendLaborCost(args: {
  base: Cents;
  quantity: number;
  otMultiplier: number;
}): Cents {
  return Math.round(args.base * args.quantity * args.otMultiplier);
}

/**
 * CA prevailing-wage classifications use an "area" modifier. Area 1 is
 * typically the Bay / Sacramento / metro counties; Area 2 is the more rural
 * counties YGE bids in (Shasta, Tehama, Butte, Plumas, Lassen, Siskiyou).
 * Actual rate lookup is done against the imported DIR tables — this helper
 * just resolves the area code from the job's county.
 */
export function dirAreaForCounty(county: string | null | undefined): 1 | 2 {
  if (!county) return 2;
  const area1Counties = new Set([
    'Alameda',
    'Contra Costa',
    'Marin',
    'Napa',
    'Sacramento',
    'San Francisco',
    'San Mateo',
    'Santa Clara',
    'Solano',
    'Sonoma',
    'Yolo',
  ]);
  return area1Counties.has(county.trim()) ? 1 : 2;
}
