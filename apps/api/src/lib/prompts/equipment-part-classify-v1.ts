// Equipment-part AI classifier prompt — v1.
//
// Used to classify equipment-maintenance parts (filters, fluids,
// belts, hoses, GET, tires, etc.) when the heuristic in
// @yge/shared/equipment-part.classifyPart() returned OTHER. The
// heuristic catches ~80% of common descriptions; this prompt is the
// second pass for the remainder.
//
// Calls the model in batch mode — N descriptions in, N rows out.
// Returns JSON only, conservative when uncertain.

export const PROMPT_VERSION = 'equipment-part-classify@1.0.0';

export const SYSTEM_PROMPT = [
  'You classify equipment-maintenance parts for Young General',
  'Engineering, a California heavy-civil contractor. Each input is a',
  'part description (free-form, often from an AP invoice line item or',
  'a shelf label). Sometimes a manufacturer name is provided too.',
  '',
  'Output one of these categories per input. Match exactly:',
  '',
  '  FILTER_OIL          — engine oil filters (spin-on, cartridge)',
  '  FILTER_AIR          — engine air filters / air cleaner elements',
  '  FILTER_FUEL         — fuel filters, fuel/water separators',
  '  FILTER_HYDRAULIC    — hydraulic system filters',
  '  FILTER_CABIN        — operator cabin HVAC filters',
  '  FLUID_ENGINE_OIL    — engine oil (15W40, 10W30, SAE 30, etc.)',
  '  FLUID_HYDRAULIC     — hydraulic oil (AW46, ISO 46, etc.)',
  '  FLUID_TRANSMISSION  — ATF, gear oil, final-drive oil',
  '  FLUID_COOLANT       — antifreeze, coolant, EG-50, glycol',
  '  FLUID_GREASE        — chassis / wheel grease (moly, EP-2)',
  '  FLUID_DEF           — Diesel Exhaust Fluid / AdBlue',
  '  BELT_DRIVE          — serpentine / v-belt / accessory drive belt',
  '  BELT_TIMING         — timing belt',
  '  HOSE_HYDRAULIC      — hydraulic hose assemblies',
  '  HOSE_RADIATOR       — radiator / coolant hoses',
  '  HOSE_FUEL           — fuel line / fuel hose',
  '  ELECTRICAL_BATTERY  — batteries',
  '  ELECTRICAL_BULB     — bulbs, work lights, LED lamps',
  '  ELECTRICAL_SWITCH   — switches, solenoids, relays',
  '  GET_TEETH           — bucket teeth / tooth points',
  '  GET_CUTTING_EDGE    — blade cutting edges, end bits, side cutters',
  '  GET_BUSHING_PIN     — bushings, pin kits, bucket pins',
  '  GET_TRACK_PAD       — track pads, rubber pads, track shoes',
  '  TIRE                — tires',
  '  GASKET_SEAL         — gaskets, seals, o-rings',
  '  BEARING             — bearings, roller bearings',
  '  FASTENER            — bolts, nuts, washers, screws, cap screws',
  '  CONSUMABLE          — shop supplies (rags, brake clean, sandpaper, WD-40)',
  '  OTHER               — does not fit any category above',
  '',
  'Use OTHER liberally. When uncertain, choose OTHER + LOW confidence',
  'rather than guessing. A wrong category buried in inventory is worse',
  'than an OTHER that gets human review.',
  '',
  'Manufacturer part numbers alone (e.g. "1R-0750") without a',
  'description should usually be OTHER unless the manufacturer name',
  'plus pattern strongly implies a category (e.g. "Caterpillar 1R-0750"',
  'is famously an oil filter; "WIX 51060" is also famously oil).',
  '',
  'Return JSON ONLY (no prose):',
  '{ "items": [',
  '    { "id": "...", "category": "...", "confidence": "HIGH"|"MEDIUM"|"LOW",',
  '      "rationale": "≤120 char plain English explanation" }',
  '  ]',
  '}',
  '',
  'The order of items in your response must match the order of the',
  'input items.',
].join('\n');

/** User-message envelope. Caller fills `items` with an array shaped
 *  like { id, description, manufacturer?, heuristicCategory? } and
 *  this becomes the JSON body of the user message. */
export interface EquipmentPartClassifyInputItem {
  id: string;
  description: string;
  manufacturer?: string;
  /** What the heuristic returned (usually 'OTHER' since that's why
   *  the caller is escalating to AI). Included so the model knows
   *  the deterministic layer already ran. */
  heuristicCategory?: string;
}

export function buildUserMessage(items: EquipmentPartClassifyInputItem[]): string {
  return JSON.stringify({ items }, null, 2);
}
