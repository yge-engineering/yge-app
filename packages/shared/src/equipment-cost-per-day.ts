// Equipment $/dispatch-day operating cost.
//
// Plain English: a piece of iron that ate $40k in maintenance
// last year and only ran 12 days is far more expensive per
// working day than one that ate $40k and ran 200 days. The cheap
// answer is "sell it." But on a 12-day-per-year piece, sometimes
// the answer is rent-out — when a sub needs a backhoe and ours
// is sitting. This pulls maintenance burn together with dispatch
// days so the choice is on one row.
//
// Per row: equipmentId, name, category, status, totalCostCents,
// daysDispatched, costPerDayCents (totalCost / daysDispatched,
// or null if no days), eventCount, firstEventOn, lastEventOn,
// lastDispatchedOn.
//
// Sort by costPerDayCents desc (most expensive per working day
// first). Pieces with 0 dispatch days are sorted last.
//
// Different from equipment-maintenance-cost (\$ only),
// equipment-dispatch-days (days only), equipment-idle (days
// since last dispatch), and equipment-fleet-age. This is the
// combined ratio.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

export interface EquipmentCostPerDayRow {
  equipmentId: string;
  name: string;
  category: Equipment['category'];
  status: Equipment['status'];
  totalCostCents: number;
  daysDispatched: number;
  costPerDayCents: number | null;
  eventCount: number;
  firstEventOn: string | null;
  lastEventOn: string | null;
  lastDispatchedOn: string | null;
}

export interface EquipmentCostPerDayRollup {
  unitsConsidered: number;
  totalCostCents: number;
  totalDaysDispatched: number;
  portfolioCostPerDayCents: number | null;
}

export interface EquipmentCostPerDayInputs {
  equipment: Equipment[];
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to maintenance performedAt
   *  (slice 0..10) and dispatch scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildEquipmentCostPerDay(
  inputs: EquipmentCostPerDayInputs,
): {
  rollup: EquipmentCostPerDayRollup;
  rows: EquipmentCostPerDayRow[];
} {
  // Index dispatch days per equipment by id (fall back to lowercased name).
  const daysById = new Map<string, Set<string>>();
  const daysByName = new Map<string, Set<string>>();
  const lastById = new Map<string, string>();
  const lastByName = new Map<string, string>();

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    for (const e of d.equipment) {
      if (e.equipmentId) {
        const set = daysById.get(e.equipmentId) ?? new Set<string>();
        set.add(d.scheduledFor);
        daysById.set(e.equipmentId, set);
        const cur = lastById.get(e.equipmentId);
        if (!cur || d.scheduledFor > cur) lastById.set(e.equipmentId, d.scheduledFor);
      } else {
        const key = e.name.trim().toLowerCase();
        if (!key) continue;
        const set = daysByName.get(key) ?? new Set<string>();
        set.add(d.scheduledFor);
        daysByName.set(key, set);
        const cur = lastByName.get(key);
        if (!cur || d.scheduledFor > cur) lastByName.set(key, d.scheduledFor);
      }
    }
  }

  const rows: EquipmentCostPerDayRow[] = [];
  let totalCost = 0;
  let totalDays = 0;

  for (const eq of inputs.equipment) {
    let costCents = 0;
    let eventCount = 0;
    let firstOn: string | null = null;
    let lastOn: string | null = null;
    for (const m of eq.maintenanceLog) {
      const slice = m.performedAt.slice(0, 10);
      if (inputs.fromDate && slice < inputs.fromDate) continue;
      if (inputs.toDate && slice > inputs.toDate) continue;
      costCents += m.costCents ?? 0;
      eventCount += 1;
      if (!firstOn || slice < firstOn) firstOn = slice;
      if (!lastOn || slice > lastOn) lastOn = slice;
    }

    const idDays = daysById.get(eq.id);
    const nameDays = daysByName.get(eq.name.trim().toLowerCase());
    const days = (idDays?.size ?? 0) + (nameDays?.size ?? 0);
    const lastDispatched = pickLater(
      lastById.get(eq.id) ?? null,
      lastByName.get(eq.name.trim().toLowerCase()) ?? null,
    );
    const costPerDay = days === 0 ? null : Math.round(costCents / days);

    rows.push({
      equipmentId: eq.id,
      name: eq.name,
      category: eq.category,
      status: eq.status,
      totalCostCents: costCents,
      daysDispatched: days,
      costPerDayCents: costPerDay,
      eventCount,
      firstEventOn: firstOn,
      lastEventOn: lastOn,
      lastDispatchedOn: lastDispatched,
    });
    totalCost += costCents;
    totalDays += days;
  }

  rows.sort((a, b) => {
    if (a.costPerDayCents == null && b.costPerDayCents == null) return 0;
    if (a.costPerDayCents == null) return 1;
    if (b.costPerDayCents == null) return -1;
    return b.costPerDayCents - a.costPerDayCents;
  });

  const portfolio = totalDays === 0 ? null : Math.round(totalCost / totalDays);

  return {
    rollup: {
      unitsConsidered: rows.length,
      totalCostCents: totalCost,
      totalDaysDispatched: totalDays,
      portfolioCostPerDayCents: portfolio,
    },
    rows,
  };
}

function pickLater(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
