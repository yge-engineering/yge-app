// Equipment idle-days report.
//
// Plain English: a backhoe sitting in the yard for six months is
// pure depreciation expense with no billable hour to offset it.
// This walks the dispatch history and computes per-equipment days-
// since-last-dispatch. Long idle = candidate to sell, rent out, or
// move to a different region.
//
// Pure derivation. No persisted records.
//
// Match logic: dispatch carries equipment[] entries, each with
// optional equipmentId. Match by equipmentId when set, otherwise
// fall back to fuzzy name match (lowercased, trimmed).

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

export type EquipmentIdleTier =
  | 'IN_USE'         // assigned to a job today, or dispatched within last 7 days
  | 'IDLE_30'        // 8-30 days since last dispatch
  | 'IDLE_60'        // 31-60 days
  | 'IDLE_90'        // 61-90 days
  | 'IDLE_LONG'      // 91+ days
  | 'NEVER_USED';    // no dispatch on record

export interface EquipmentIdleRow {
  equipmentId: string;
  name: string;
  category: Equipment['category'];
  status: Equipment['status'];

  /** Latest scheduledFor across non-CANCELLED dispatches that match
   *  this equipment. Null when no match. */
  lastDispatchedOn: string | null;
  /** Days from lastDispatchedOn to asOf. Null when never dispatched. */
  idleDays: number | null;
  /** Number of distinct dispatches that match. */
  dispatchCount: number;

  tier: EquipmentIdleTier;
}

export interface EquipmentIdleRollup {
  total: number;
  inUse: number;
  idle30: number;
  idle60: number;
  idle90: number;
  idleLong: number;
  neverUsed: number;
}

export interface EquipmentIdleInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  equipment: Equipment[];
  dispatches: Dispatch[];
}

export function buildEquipmentIdleReport(
  inputs: EquipmentIdleInputs,
): { rows: EquipmentIdleRow[]; rollup: EquipmentIdleRollup } {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  // Index match keys: by equipmentId AND by lowercase name.
  const byEquipmentId = new Map<string, { last: string; count: number }>();
  const byName = new Map<string, { last: string; count: number }>();

  for (const d of inputs.dispatches) {
    if (d.status === 'CANCELLED' || d.status === 'DRAFT') continue;
    for (const item of d.equipment ?? []) {
      const ts = d.scheduledFor;
      if (item.equipmentId) {
        const cur = byEquipmentId.get(item.equipmentId) ?? { last: '', count: 0 };
        if (ts > cur.last) cur.last = ts;
        cur.count += 1;
        byEquipmentId.set(item.equipmentId, cur);
      } else if (item.name) {
        const k = item.name.trim().toLowerCase();
        const cur = byName.get(k) ?? { last: '', count: 0 };
        if (ts > cur.last) cur.last = ts;
        cur.count += 1;
        byName.set(k, cur);
      }
    }
  }

  const rows: EquipmentIdleRow[] = [];
  for (const e of inputs.equipment) {
    const fromId = byEquipmentId.get(e.id);
    const fromName = byName.get(e.name.trim().toLowerCase());

    let last = '';
    let count = 0;
    if (fromId) {
      last = fromId.last;
      count = fromId.count;
    }
    if (fromName) {
      if (fromName.last > last) last = fromName.last;
      count += fromName.count;
    }
    const lastDispatchedOn = last || null;
    const idleDays = lastDispatchedOn
      ? Math.max(0, daysBetween(lastDispatchedOn, asOf))
      : null;

    let tier: EquipmentIdleTier;
    if (idleDays == null) tier = 'NEVER_USED';
    else if (idleDays <= 7 || e.status === 'ASSIGNED') tier = 'IN_USE';
    else if (idleDays <= 30) tier = 'IDLE_30';
    else if (idleDays <= 60) tier = 'IDLE_60';
    else if (idleDays <= 90) tier = 'IDLE_90';
    else tier = 'IDLE_LONG';

    rows.push({
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      status: e.status,
      lastDispatchedOn,
      idleDays,
      dispatchCount: count,
      tier,
    });
  }

  // Sort: longest idle first; NEVER_USED behind LONG; IN_USE last.
  const tierRank: Record<EquipmentIdleTier, number> = {
    IDLE_LONG: 0,
    IDLE_90: 1,
    IDLE_60: 2,
    IDLE_30: 3,
    NEVER_USED: 4,
    IN_USE: 5,
  };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
    const ai = a.idleDays ?? Number.POSITIVE_INFINITY;
    const bi = b.idleDays ?? Number.POSITIVE_INFINITY;
    return bi - ai; // most idle first within tier
  });

  let inUse = 0;
  let idle30 = 0;
  let idle60 = 0;
  let idle90 = 0;
  let idleLong = 0;
  let neverUsed = 0;
  for (const r of rows) {
    if (r.tier === 'IN_USE') inUse += 1;
    else if (r.tier === 'IDLE_30') idle30 += 1;
    else if (r.tier === 'IDLE_60') idle60 += 1;
    else if (r.tier === 'IDLE_90') idle90 += 1;
    else if (r.tier === 'IDLE_LONG') idleLong += 1;
    else neverUsed += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      inUse,
      idle30,
      idle60,
      idle90,
      idleLong,
      neverUsed,
    },
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
