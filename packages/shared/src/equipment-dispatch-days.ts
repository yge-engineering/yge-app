// Per-equipment dispatch days.
//
// Plain English: every dispatch record names a foreman and a list of
// equipment that's expected on the job that day. Walking that
// across a date window tells us how many days each piece of iron
// was actually scheduled to work — which is the closest thing we
// have to a utilization rate without a meter ping.
//
// Drives:
//   - which units are sitting in the yard (low utilization → sell?
//     rent out? rotate?)
//   - which units are double-booked across jobs (planning bug)
//   - rate-book sanity check (high-utilization units justify lower
//     internal rental cost; low-utilization the opposite)
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

export type UtilizationFlag =
  | 'HIGH'        // > 60% of working days
  | 'NORMAL'      // 30-60%
  | 'LOW'         // 10-30%
  | 'IDLE';       // < 10%

export interface EquipmentDispatchDaysRow {
  equipmentId: string | null;
  equipmentName: string;
  category: Equipment['category'] | null;
  /** Distinct yyyy-mm-dd dates this unit was dispatched. */
  daysDispatched: number;
  /** Distinct jobIds this unit was assigned to. */
  jobsServed: number;
  /** daysDispatched / windowDays. 0..1. */
  utilizationPct: number;
  /** Days where the unit appears on multiple POSTED dispatches —
   *  scheduling bug indicator. */
  doubleBookedDays: number;
  flag: UtilizationFlag;
}

export interface EquipmentDispatchDaysRollup {
  unitsConsidered: number;
  windowDays: number;
  /** Total dispatched-day count summed across units (may exceed
   *  windowDays * units when double-booking exists). */
  totalDispatchedDays: number;
  high: number;
  normal: number;
  low: number;
  idle: number;
  doubleBookedUnits: number;
}

export interface EquipmentDispatchDaysInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  /** Equipment master so units that NEVER showed up on a dispatch
   *  in the window also surface (as IDLE). RETIRED + SOLD skipped. */
  equipment: Equipment[];
  dispatches: Dispatch[];
  /** When false (default), only POSTED + COMPLETED dispatches count.
   *  DRAFT plans may shift; CANCELLED never happened. */
  includeDraftDispatches?: boolean;
}

export function buildEquipmentDispatchDays(
  inputs: EquipmentDispatchDaysInputs,
): {
  rollup: EquipmentDispatchDaysRollup;
  rows: EquipmentDispatchDaysRow[];
} {
  const includeDraft = inputs.includeDraftDispatches === true;
  const windowDays = countWindowDays(inputs.fromDate, inputs.toDate);

  // Filter equipment to active units (skip RETIRED/SOLD).
  const activeEquip = inputs.equipment.filter(
    (e) => e.status !== 'RETIRED' && e.status !== 'SOLD',
  );
  const equipById = new Map<string, Equipment>();
  for (const e of activeEquip) equipById.set(e.id, e);

  // Per-unit aggregation.
  type Bucket = {
    equipmentId: string | null;
    equipmentName: string;
    category: Equipment['category'] | null;
    /** date → count of dispatches on that date for this unit. */
    daysSeen: Map<string, number>;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const d of inputs.dispatches) {
    if (d.scheduledFor < inputs.fromDate) continue;
    if (d.scheduledFor > inputs.toDate) continue;
    if (
      !includeDraft &&
      d.status !== 'POSTED' &&
      d.status !== 'COMPLETED'
    ) continue;

    for (const eq of d.equipment) {
      // Prefer equipmentId; fall back to name when unlinked.
      const knownEquip = eq.equipmentId ? equipById.get(eq.equipmentId) : null;
      const key = eq.equipmentId ?? `name:${eq.name.trim().toLowerCase()}`;
      const b = buckets.get(key) ?? {
        equipmentId: eq.equipmentId ?? null,
        equipmentName: knownEquip?.name ?? eq.name,
        category: knownEquip?.category ?? null,
        daysSeen: new Map<string, number>(),
        jobs: new Set<string>(),
      };
      b.daysSeen.set(
        d.scheduledFor,
        (b.daysSeen.get(d.scheduledFor) ?? 0) + 1,
      );
      b.jobs.add(d.jobId);
      buckets.set(key, b);
    }
  }

  // Add never-dispatched active equipment to surface IDLE rows.
  for (const e of activeEquip) {
    if (!buckets.has(e.id)) {
      buckets.set(e.id, {
        equipmentId: e.id,
        equipmentName: e.name,
        category: e.category,
        daysSeen: new Map<string, number>(),
        jobs: new Set<string>(),
      });
    }
  }

  const rows: EquipmentDispatchDaysRow[] = [];
  const counts = { high: 0, normal: 0, low: 0, idle: 0 };
  let totalDays = 0;
  let doubleBookedUnits = 0;

  for (const b of buckets.values()) {
    const days = b.daysSeen.size;
    const doubleBookedDays = Array.from(b.daysSeen.values()).filter(
      (n) => n > 1,
    ).length;
    const utilization =
      windowDays === 0 ? 0 : days / windowDays;
    const flag = classify(utilization);

    rows.push({
      equipmentId: b.equipmentId,
      equipmentName: b.equipmentName,
      category: b.category,
      daysDispatched: days,
      jobsServed: b.jobs.size,
      utilizationPct: round4(utilization),
      doubleBookedDays,
      flag,
    });

    totalDays += days;
    if (flag === 'HIGH') counts.high += 1;
    else if (flag === 'NORMAL') counts.normal += 1;
    else if (flag === 'LOW') counts.low += 1;
    else counts.idle += 1;
    if (doubleBookedDays > 0) doubleBookedUnits += 1;
  }

  // Highest utilization first.
  rows.sort((a, b) => b.utilizationPct - a.utilizationPct);

  return {
    rollup: {
      unitsConsidered: rows.length,
      windowDays,
      totalDispatchedDays: totalDays,
      high: counts.high,
      normal: counts.normal,
      low: counts.low,
      idle: counts.idle,
      doubleBookedUnits,
    },
    rows,
  };
}

function classify(util: number): UtilizationFlag {
  if (util >= 0.6) return 'HIGH';
  if (util >= 0.3) return 'NORMAL';
  if (util >= 0.1) return 'LOW';
  return 'IDLE';
}

function countWindowDays(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  const diff = Math.round((t.getTime() - f.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff + 1); // inclusive
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
