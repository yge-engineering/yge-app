// Pre-bid site-walkdown checklist.
//
// What the estimator should physically verify on a site visit before
// pricing the bid. The cost of finding any of these out AFTER awarding
// the contract is far higher than the time of a site walk.
//
// Per-projectType templates plus a "common" set that every walk gets.
// Items are short imperative phrases ("Confirm water-truck fill point",
// not "Water source") so they read like a worker punch list on paper.
//
// Used by:
//   - Plans-to-Estimate UI to seed a "Site visit before bidding" panel
//     under the AI's questionsForEstimator list.
//   - Future: a print-friendly /site-walkdown route the estimator
//     hands to the foreman who's on site that day.

import type { PtoEProjectType } from './plans-to-estimate-output';

export interface WalkdownItem {
  /** Stable id for printing/ticking. Per-template, not globally unique. */
  id: string;
  /** Short imperative — "Confirm access width for low-boy", etc. */
  label: string;
  /** Optional context the estimator might forget if they don't see it
   *  spelled out ("most sites require min 12-ft width"). */
  note?: string;
}

export interface WalkdownChecklist {
  projectType: PtoEProjectType;
  items: WalkdownItem[];
}

/** Items every walk gets regardless of project type. */
const COMMON_ITEMS: WalkdownItem[] = [
  {
    id: 'common-access',
    label: 'Walk site access from public road',
    note: 'Confirm width / overhead clearance / load limit for low-boy + tri-axle.',
  },
  {
    id: 'common-water',
    label: 'Identify water-truck fill point',
    note: 'Hydrant w/ valid CWA #, creek with pump permit, or trucked-in.',
  },
  {
    id: 'common-stockpile',
    label: 'Confirm stockpile / staging area location',
    note: 'On-site preferred; off-site = haul cost + traffic-control add.',
  },
  {
    id: 'common-disposal',
    label: 'Confirm spoil / disposal site',
    note: 'On-site cut/fill balance, or named off-site disposal w/ haul distance.',
  },
  {
    id: 'common-utilities',
    label: 'Photograph existing utilities (overhead + underground markers)',
    note: 'USA dig-alert tickets at bid time; on-site verifies markers match.',
  },
  {
    id: 'common-neighbors',
    label: 'Note adjacent property constraints',
    note: 'Easements, neighbor wells, no-truck residential street, school zone hours.',
  },
  {
    id: 'common-photos',
    label: 'Date-stamped photos of existing pavement / vegetation / structures',
    note: 'Pre-existing conditions evidence for any change-order dispute.',
  },
];

/** Per-projectType extras. Concatenated AFTER the common set. */
const TYPE_EXTRAS: Record<PtoEProjectType, WalkdownItem[]> = {
  ROAD_RECONSTRUCTION: [
    {
      id: 'road-existing-pavement',
      label: 'Core / probe existing pavement at 3+ stations',
      note: 'Validates RAP depth + thickness assumptions in the bid.',
    },
    {
      id: 'road-drainage-tie',
      label: 'Trace existing drainage flow patterns',
      note: 'Plans may show new inlets without showing what feeds them.',
    },
    {
      id: 'road-traffic-control',
      label: 'Estimate traffic-control duration + flagger crew size',
      note: 'Highway through-traffic adds significant TC cost beyond the line.',
    },
    {
      id: 'road-utility-conflicts',
      label: 'Spot above-ground utilities that may need relocation',
      note: 'Power poles, signage, hydrants in the new grade line.',
    },
  ],
  DRAINAGE: [
    {
      id: 'drain-receiving',
      label: 'Walk the receiving watercourse / outfall',
      note: 'Spec may require headwall + riprap if outfall is into a creek.',
    },
    {
      id: 'drain-water-table',
      label: 'Check for high-water-table evidence in trench area',
      note: 'Spring lines, cattails, soft ground → dewatering cost.',
    },
    {
      id: 'drain-existing-pipes',
      label: 'Tie-in to existing pipe — measure invert depth + condition',
      note: "Doc doesn't always show; tie-in failure is a frequent change order.",
    },
    {
      id: 'drain-permits',
      label: 'Confirm whether Section 401 / 404 / streambed alteration permits apply',
      note: 'Work in a blue-line stream triggers Fish & Wildlife notification.',
    },
  ],
  BRIDGE: [
    {
      id: 'bridge-access-belowdeck',
      label: 'Walk under the bridge — confirm work-bridge access + falsework footprint',
    },
    {
      id: 'bridge-stream',
      label: 'Note in-stream work window (Fish & Wildlife) + flow at site',
    },
    {
      id: 'bridge-crane',
      label: 'Lay out crane pick locations — confirm setup pad + boom radius',
    },
    {
      id: 'bridge-detour',
      label: 'Identify detour route + length if traffic must reroute',
    },
  ],
  GRADING: [
    {
      id: 'grade-soil',
      label: 'Probe / shovel-test native soil at proposed cut areas',
      note: 'Confirms swell factor assumption + rippability (rock means blast).',
    },
    {
      id: 'grade-balance',
      label: 'Walk the cut/fill plan — verify on-site balance assumption',
    },
    {
      id: 'grade-erosion',
      label: 'Note slope length + steepness for erosion-control bid items',
    },
    {
      id: 'grade-haul-road',
      label: 'Identify on-site haul-road route between cut + fill',
    },
  ],
  FIRE_FUEL_REDUCTION: [
    {
      id: 'ffr-slope-class',
      label: 'GPS-tag slope-class transitions (0-30%, 30-50%, 50%+)',
      note: 'Slope class drives per-acre price + crew type (hand vs masticator).',
    },
    {
      id: 'ffr-spotted-owl',
      label: 'Confirm spotted-owl / NSO LOP / breeding-season constraints',
      note: 'Limited operating period can knock months out of the season.',
    },
    {
      id: 'ffr-haul',
      label: 'Identify chip-pile haul-out or burn-pile location',
    },
    {
      id: 'ffr-access',
      label: 'Walk access roads — confirm masticator / chipper transport',
      note: 'Hairpin turns / soft road shoulders can sideline equipment.',
    },
    {
      id: 'ffr-water',
      label: 'Confirm fire-watch water source + truck staging area',
      note: 'CAL FIRE typically requires fire watch during + after operations.',
    },
  ],
  OTHER: [
    {
      id: 'other-scope',
      label: 'Write a one-paragraph scope summary in your own words',
      note: 'If you can\'t summarize what you\'re bidding on, you\'re not ready to bid it.',
    },
  ],
};

/** Build the per-projectType checklist by combining common items
 *  with the type-specific extras. */
export function buildWalkdownChecklist(
  projectType: PtoEProjectType,
): WalkdownChecklist {
  const extras = TYPE_EXTRAS[projectType] ?? [];
  return {
    projectType,
    items: [...COMMON_ITEMS, ...extras],
  };
}

/** Count of items in the checklist for a project type. Handy for
 *  the chip count on the Plans-to-Estimate panel header. */
export function walkdownItemCount(projectType: PtoEProjectType): number {
  return buildWalkdownChecklist(projectType).items.length;
}
