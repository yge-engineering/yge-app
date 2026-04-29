// Equipment utilization summary (portfolio).
//
// Plain English: across the equipment fleet, count units in each
// utilization tier (HEAVY / NORMAL / LIGHT / IDLE) based on
// distinct dispatch days vs working days in the window. Roll up
// by EquipmentCategory so the fleet review sees "we have 8
// excavators, 2 are heavy-utilized, 6 are idle".
//
// "Working days" defaults to Mon-Fri count between fromDate +
// toDate.
//
// Per row: tier, label, count, byCategory.
//
// Sort: HEAVY → NORMAL → LIGHT → IDLE.
//
// Different from equipment-dispatch-days (per-piece days),
// equipment-idle (idle-days tier), equipment-cost-per-day
// (\$/day per piece). This is the portfolio utilization mix.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentCategory } from './equipment';

export type UtilTier = 'HEAVY' | 'NORMAL' | 'LIGHT' | 'IDLE';

export interface EquipmentUtilizationRow {
  tier: UtilTier;
  label: string;
  count: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
}

export interface EquipmentUtilizationRollup {
  unitsConsidered: number;
  workingDays: number;
  totalDispatchDays: number;
}

export interface EquipmentUtilizationInputs {
  equipment: Equipment[];
  dispatches: Dispatch[];
  /** Required yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
}

const ORDER: UtilTier[] = ['HEAVY', 'NORMAL', 'LIGHT', 'IDLE'];
const LABELS: Record<UtilTier, string> = {
  HEAVY: '> 60% of working days',
  NORMAL: '30 – 60%',
  LIGHT: '5 – 30%',
  IDLE: '< 5%',
};

export function buildEquipmentUtilizationSummary(
  inputs: EquipmentUtilizationInputs,
): {
  rollup: EquipmentUtilizationRollup;
  rows: EquipmentUtilizationRow[];
} {
  const workingDays = countWorkingDays(inputs.fromDate, inputs.toDate);
  const daysById = new Map<string, Set<string>>();
  const daysByName = new Map<string, Set<string>>();

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (d.scheduledFor < inputs.fromDate) continue;
    if (d.scheduledFor > inputs.toDate) continue;
    for (const e of d.equipment) {
      if (e.equipmentId) {
        const set = daysById.get(e.equipmentId) ?? new Set<string>();
        set.add(d.scheduledFor);
        daysById.set(e.equipmentId, set);
      } else if (e.name.trim()) {
        const k = e.name.trim().toLowerCase();
        const set = daysByName.get(k) ?? new Set<string>();
        set.add(d.scheduledFor);
        daysByName.set(k, set);
      }
    }
  }

  type Acc = {
    count: number;
    cats: Map<EquipmentCategory, number>;
  };
  const accs = new Map<UtilTier, Acc>();
  for (const t of ORDER) accs.set(t, { count: 0, cats: new Map() });

  let totalDispatchDays = 0;
  for (const eq of inputs.equipment) {
    const idDays = daysById.get(eq.id)?.size ?? 0;
    const nameDays = daysByName.get(eq.name.trim().toLowerCase())?.size ?? 0;
    const days = idDays + nameDays;
    totalDispatchDays += days;
    const pct = workingDays === 0 ? 0 : days / workingDays;
    let tier: UtilTier;
    if (pct > 0.6) tier = 'HEAVY';
    else if (pct >= 0.3) tier = 'NORMAL';
    else if (pct >= 0.05) tier = 'LIGHT';
    else tier = 'IDLE';
    const acc = accs.get(tier)!;
    acc.count += 1;
    acc.cats.set(eq.category, (acc.cats.get(eq.category) ?? 0) + 1);
  }

  const rows: EquipmentUtilizationRow[] = [];
  for (const tier of ORDER) {
    const acc = accs.get(tier);
    if (!acc) continue;
    const obj: Partial<Record<EquipmentCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      tier,
      label: LABELS[tier],
      count: acc.count,
      byCategory: obj,
    });
  }

  return {
    rollup: {
      unitsConsidered: inputs.equipment.length,
      workingDays,
      totalDispatchDays,
    },
    rows,
  };
}

function countWorkingDays(fromYmd: string, toYmd: string): number {
  const from = Date.parse(fromYmd + 'T00:00:00Z');
  const to = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  let count = 0;
  for (let t = from; t <= to; t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}
