// Equipment service-due tracker.
//
// Plain English: every piece of equipment has a service interval —
// "change the dozer oil every 250 hours", "flush the F-450 trans every
// 30,000 miles." This walks the fleet, finds the last service in the
// maintenance log, and tells the shop what's overdue or coming up.
//
// Pure derivation. No persisted records. Reads Equipment.maintenanceLog
// + Equipment.lastServiceUsage + Equipment.serviceIntervalUsage and
// computes the rest.
//
// Flag tiers (worst first):
//   OVERDUE     — usageSinceService > serviceIntervalUsage
//   DUE_SOON    — within 90% of the next service
//   OK          — under 90% of next service
//   NO_SCHEDULE — equipment has no serviceIntervalUsage set (some
//                 trailers, attachments). Surfaced separately.

import type { Equipment, EquipmentUsageMetric } from './equipment';

export type EquipmentServiceFlag = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NO_SCHEDULE';

export interface EquipmentServiceRow {
  equipmentId: string;
  name: string;
  category: Equipment['category'];

  usageMetric: EquipmentUsageMetric;
  /** Current odometer / hour-meter. */
  currentUsage: number;
  /** Usage at the most recent service in the log; falls back to
   *  Equipment.lastServiceUsage; falls back to 0. */
  lastServiceUsage: number;
  /** Date of the last service (ISO). Null when no log entries and no
   *  fallback date exists. */
  lastServiceDate: string | null;
  /** Equipment.serviceIntervalUsage — null when unit has no schedule. */
  serviceIntervalUsage: number | null;

  /** currentUsage - lastServiceUsage. */
  usageSinceService: number;
  /** serviceIntervalUsage - usageSinceService. Negative = overdue. Null
   *  when no schedule. */
  usageUntilDue: number | null;
  /** usageSinceService / serviceIntervalUsage as a fraction. Null when
   *  no schedule. */
  fractionOfInterval: number | null;

  flag: EquipmentServiceFlag;
}

export interface EquipmentServiceRollup {
  total: number;
  overdue: number;
  dueSoon: number;
  ok: number;
  noSchedule: number;
}

export interface EquipmentServiceInputs {
  equipment: Equipment[];
  /** Threshold for DUE_SOON. fraction >= dueSoonThreshold && < 1.
   *  Defaults to 0.9 (90% of next service). */
  dueSoonThreshold?: number;
}

export function buildEquipmentServiceBoard(inputs: EquipmentServiceInputs): {
  rows: EquipmentServiceRow[];
  rollup: EquipmentServiceRollup;
} {
  const dueSoonThreshold = inputs.dueSoonThreshold ?? 0.9;
  const rows: EquipmentServiceRow[] = [];

  for (const eq of inputs.equipment) {
    // Find most-recent service in the log; fall back to lastServiceUsage.
    let lastServiceUsage = eq.lastServiceUsage ?? 0;
    let lastServiceDate: string | null = null;
    if ((eq.maintenanceLog ?? []).length > 0) {
      // Pick the entry with the most recent performedAt timestamp.
      const sorted = [...eq.maintenanceLog].sort((a, b) =>
        a.performedAt.localeCompare(b.performedAt),
      );
      const latest = sorted[sorted.length - 1]!;
      lastServiceUsage = latest.usageAtService;
      lastServiceDate = latest.performedAt.slice(0, 10);
    }

    const usageSinceService = Math.max(0, eq.currentUsage - lastServiceUsage);
    const interval = eq.serviceIntervalUsage ?? null;

    let fractionOfInterval: number | null = null;
    let usageUntilDue: number | null = null;
    let flag: EquipmentServiceFlag;

    if (interval == null || interval <= 0) {
      flag = 'NO_SCHEDULE';
    } else {
      fractionOfInterval = usageSinceService / interval;
      usageUntilDue = interval - usageSinceService;
      if (usageUntilDue < 0) flag = 'OVERDUE';
      else if (fractionOfInterval >= dueSoonThreshold) flag = 'DUE_SOON';
      else flag = 'OK';
    }

    rows.push({
      equipmentId: eq.id,
      name: eq.name,
      category: eq.category,
      usageMetric: eq.usageMetric,
      currentUsage: eq.currentUsage,
      lastServiceUsage,
      lastServiceDate,
      serviceIntervalUsage: interval,
      usageSinceService,
      usageUntilDue,
      fractionOfInterval,
      flag,
    });
  }

  // Sort: OVERDUE first (most overdue → most negative usageUntilDue),
  // then DUE_SOON (highest fraction first), then OK, then NO_SCHEDULE.
  const tierRank: Record<EquipmentServiceFlag, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    OK: 2,
    NO_SCHEDULE: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    if (a.flag === 'OVERDUE') {
      // Most overdue (most negative usageUntilDue) first.
      const au = a.usageUntilDue ?? 0;
      const bu = b.usageUntilDue ?? 0;
      return au - bu;
    }
    if (a.flag === 'DUE_SOON') {
      // Highest fraction first (closest to overdue).
      const af = a.fractionOfInterval ?? 0;
      const bf = b.fractionOfInterval ?? 0;
      return bf - af;
    }
    return a.name.localeCompare(b.name);
  });

  let overdue = 0;
  let dueSoon = 0;
  let ok = 0;
  let noSchedule = 0;
  for (const r of rows) {
    if (r.flag === 'OVERDUE') overdue += 1;
    else if (r.flag === 'DUE_SOON') dueSoon += 1;
    else if (r.flag === 'OK') ok += 1;
    else noSchedule += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      overdue,
      dueSoon,
      ok,
      noSchedule,
    },
  };
}
