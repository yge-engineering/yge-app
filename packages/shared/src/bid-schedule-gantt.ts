// Bid-schedule Gantt builder.
//
// Plain English: turns the AI's priced bid items into a Gantt-style
// schedule of tasks with start / end dates relative to notice-to-
// proceed. Computes each task's duration from quantity ÷ production
// rate × site-condition multiplier, then chains tasks by trade
// precedence (mob → earthwork → utilities → foundations → above-
// ground → paving → striping → fence/finish → demob). Items in the
// same group can overlap; items in later groups wait on their
// predecessors.
//
// Output drives the bar-chart view that renders below the estimate.
// Pure function, no I/O, no calendar holidays applied here — the UI
// can compose this with the CA-holiday helper when it wants actual
// calendar dates.

import type { PtoEBidItem } from './plans-to-estimate-output';
import {
  DEFAULT_PRODUCTION_RATES,
  SITE_CONDITION_MULTIPLIER,
  crewDaysForQuantity,
  findBestRate,
  type ProductionRate,
  type SiteCondition,
} from './production-rates';

/** Trade groups in execution order. Within a group, tasks parallelize
 *  (mob items can overlap with each other); between groups they
 *  sequence. */
export type GanttGroup =
  | 'MOB'
  | 'CLEARING'
  | 'EARTHWORK'
  | 'UTILITY'
  | 'CONCRETE'
  | 'STRUCTURE'
  | 'PAVING'
  | 'STRIPING'
  | 'FENCE'
  | 'EROSION_CONTROL'
  | 'DEMOB'
  | 'OTHER';

export const GANTT_GROUP_ORDER: GanttGroup[] = [
  'MOB',
  'CLEARING',
  'EARTHWORK',
  'UTILITY',
  'CONCRETE',
  'STRUCTURE',
  'PAVING',
  'STRIPING',
  'FENCE',
  'EROSION_CONTROL',
  'DEMOB',
  'OTHER',
];

export const GANTT_GROUP_LABEL: Record<GanttGroup, string> = {
  MOB: 'Mobilization',
  CLEARING: 'Clearing & grubbing',
  EARTHWORK: 'Earthwork',
  UTILITY: 'Utilities',
  CONCRETE: 'Concrete & foundations',
  STRUCTURE: 'Structures',
  PAVING: 'Paving',
  STRIPING: 'Striping',
  FENCE: 'Fence & finish',
  EROSION_CONTROL: 'Erosion control',
  DEMOB: 'Demobilization',
  OTHER: 'Other',
};

export interface GanttTask {
  /** Echoes the bid-item key for click-back to the line. */
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  group: GanttGroup;
  /** Working days the task takes (already site-condition adjusted). */
  durationDays: number;
  /** Working-day offset from NTP. Day 0 = NTP, day 1 = first work day. */
  startDay: number;
  endDay: number;
  /** True when this task is on the critical path (sequential through
   *  all groups). Items inside the same group that aren't the longest
   *  in their group are NOT critical. */
  onCriticalPath: boolean;
  /** Friendly note about the production rate used (e.g.
   *  "structural-fill-95pct ~300 CY/day × 1.7 LIVE = ~16 days"). */
  rateNote?: string;
}

export interface BuildGanttInput {
  bidItems: PtoEBidItem[];
  siteCondition?: SiteCondition;
  /** Optional override library — caller can pass YGE-specific rates
   *  here. */
  productionRates?: ProductionRate[];
  /** Add a fixed prefix of mobilization workdays (default 3). */
  mobDays?: number;
  /** Add a fixed suffix of demobilization workdays (default 2). */
  demobDays?: number;
  /** Add per-group inspection-hold drag (default 0 — caller supplies
   *  the agency-specific override). */
  groupInspectionHoldDays?: Partial<Record<GanttGroup, number>>;
}

export interface GanttResult {
  tasks: GanttTask[];
  /** Total workday duration across the critical path. */
  totalDays: number;
  /** Per-group spans (start/end workday) so the UI can render
   *  group-level brackets above the bar rows. */
  groupSpans: Array<{ group: GanttGroup; startDay: number; endDay: number }>;
}

/** Map a bid-item description / unit / shared-rate hint into a Gantt
 *  group. Keyword-based, conservative — items that don't match
 *  fall into OTHER. Order matters: utility keywords are checked
 *  before earthwork because phrases like "conduit trench + backfill"
 *  contain both, but the dominant scope is the utility install. */
function inferGroup(item: PtoEBidItem): GanttGroup {
  const d = item.description.toLowerCase();
  // Stems use leading \b only so "excav" matches "excavation" /
  // "excavate" / "excavator" but won't match "preexcav" mid-word.
  // Full words use \b...\b for an exact match (e.g. \bfill\b
  // correctly skips "backfill").
  if (/\bmobiliz|\bmob\b|moving in/.test(d)) return 'MOB';
  if (/\bdemobiliz|\bdemob\b|moving out|final clean/.test(d)) return 'DEMOB';
  if (/\bclear|\bgrub|tree remov/.test(d)) return 'CLEARING';
  // Utility BEFORE earthwork — "conduit trench + backfill" reads
  // utility-first even though "fill" alone would also match
  // earthwork (it doesn't, since \bfill\b doesn't see backfill, but
  // it's still the right precedence).
  if (
    /\b(conduit|duct|ground rod|ground grid|cable tray|trench|storm drain|sewer|water main|manhole|vault)\b|pipe install/.test(
      d,
    )
  ) {
    return 'UTILITY';
  }
  if (/silt fence|\berosion|swppp|hydroseed|straw wattle|fiber roll/.test(d)) {
    return 'EROSION_CONTROL';
  }
  if (
    /\bexcav|\bearthwork|\bgrad|\bcut\b|\bscrape|\bstrip|\btopsoil|\bborrow|\bcompact|\bsubgrade|\bcrushed misc|\bfill\b|aggregate base|class 2 ab|class ii base/.test(
      d,
    )
  ) {
    return 'EARTHWORK';
  }
  if (
    /\bfoundation|\bfooting|\bpier\b|\bencased duct|\boil contain|\bberm|\bflatwork|\bsidewalk|\bcurb|\bgutter|\bpour|grade beam|equipment pad/.test(
      d,
    )
  ) {
    return 'CONCRETE';
  }
  if (/\btransformer|\bswitchgear|\bbuilding|\bgirder|\bbeam\b|\bsteel\b|\bprefab|\btower|bridge deck/.test(d)) {
    return 'STRUCTURE';
  }
  if (/\basphalt|\bpaving|\brhma|\bhma\b|\bslurry|ac pav|seal coat|chip seal/.test(d)) {
    return 'PAVING';
  }
  if (
    /\bthermoplastic|\bstriping|\blegend|\bstencil|\bcrosswalk|stop bar|\bstripe/.test(
      d,
    )
  ) {
    return 'STRIPING';
  }
  if (/\bfence|\bgate\b|\bbollard/.test(d)) return 'FENCE';
  return 'OTHER';
}

/** Build a Gantt-ready task list from the bid items + production
 *  rates + site condition. */
export function buildBidGantt(input: BuildGanttInput): GanttResult {
  const condition: SiteCondition = input.siteCondition ?? 'UNKNOWN';
  const multiplier = SITE_CONDITION_MULTIPLIER[condition];
  const library = input.productionRates ?? DEFAULT_PRODUCTION_RATES;
  const mobDays = input.mobDays ?? 3;
  const demobDays = input.demobDays ?? 2;
  const holds = input.groupInspectionHoldDays ?? {};

  // Convert each bid item into a raw task (no offset yet).
  type Raw = {
    item: PtoEBidItem;
    group: GanttGroup;
    durationDays: number;
    rateNote?: string;
  };

  const raw: Raw[] = input.bidItems
    .map((item): Raw | null => {
      const group = inferGroup(item);
      if (item.quantity <= 0) return null;
      const rate = findBestRate(
        { description: item.description, unit: item.unit },
        library,
      );
      let crewDays: number;
      let rateNote: string | undefined;
      if (rate) {
        crewDays = crewDaysForQuantity(item.quantity, rate);
        rateNote = `${rate.task} ~${Math.round(
          (rate.perCrewDayLow + rate.perCrewDayHigh) / 2,
        )} ${item.unit}/day`;
      } else {
        // No matching rate — fall back to a soft default so the bar
        // shows up but with a "rate unknown" hint. 5 days is the
        // YGE default placeholder.
        crewDays = 5;
        rateNote = `no matching production rate — placeholder 5 days`;
      }
      const adjusted = crewDays * multiplier;
      const durationDays = Math.max(1, Math.round(adjusted));
      return { item, group, durationDays, rateNote };
    })
    .filter((x): x is Raw => x !== null);

  // Bucket by group.
  const byGroup = new Map<GanttGroup, Raw[]>();
  for (const r of raw) {
    const arr = byGroup.get(r.group) ?? [];
    arr.push(r);
    byGroup.set(r.group, arr);
  }

  // Prepend MOB if not already represented; append DEMOB the same way.
  if (!byGroup.has('MOB')) {
    byGroup.set('MOB', [
      {
        item: {
          itemNumber: 'M',
          description: 'Mobilization',
          unit: 'LS',
          quantity: 1,
          confidence: 'HIGH',
        },
        group: 'MOB',
        durationDays: mobDays,
        rateNote: `fixed mob default ${mobDays} days`,
      },
    ]);
  }
  if (!byGroup.has('DEMOB')) {
    byGroup.set('DEMOB', [
      {
        item: {
          itemNumber: 'D',
          description: 'Demobilization + cleanup',
          unit: 'LS',
          quantity: 1,
          confidence: 'HIGH',
        },
        group: 'DEMOB',
        durationDays: demobDays,
        rateNote: `fixed demob default ${demobDays} days`,
      },
    ]);
  }

  // Walk groups in declared order. Each group starts after the
  // previous group finishes; within a group, tasks parallelize so
  // the group's duration = max task duration.
  const tasks: GanttTask[] = [];
  const groupSpans: GanttResult['groupSpans'] = [];
  let cursor = 0;
  for (const group of GANTT_GROUP_ORDER) {
    const items = byGroup.get(group);
    if (!items || items.length === 0) continue;
    const groupStart = cursor;
    const hold = holds[group] ?? 0;
    const longest = items.reduce(
      (max, r) => (r.durationDays > max ? r.durationDays : max),
      0,
    );
    const groupEnd = groupStart + longest + hold;
    for (const r of items) {
      tasks.push({
        itemNumber: r.item.itemNumber,
        description: r.item.description,
        unit: r.item.unit,
        quantity: r.item.quantity,
        group,
        durationDays: r.durationDays,
        startDay: groupStart,
        endDay: groupStart + r.durationDays,
        // Only the longest item in each group sits on the critical
        // path; shorter parallel items have slack.
        onCriticalPath: r.durationDays === longest,
        rateNote: r.rateNote,
      });
    }
    groupSpans.push({ group, startDay: groupStart, endDay: groupEnd });
    cursor = groupEnd;
  }

  return {
    tasks,
    totalDays: cursor,
    groupSpans,
  };
}
