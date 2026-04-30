// Equipment-anchored maintenance snapshot.
//
// Plain English: for one equipment unit, as-of today, count
// maintenance entries, sum cost cents, kind mix, current
// usage, last service usage + date, usage-until-service flag.
// Drives the right-now per-unit maintenance overview.
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

import { isServiceDue, nextServiceDueUsage, serviceDueLevel, usageUntilService } from './equipment';

export interface EquipmentMaintenanceSnapshotResult {
  asOf: string;
  equipmentId: string;
  totalEntries: number;
  totalCostCents: number;
  byKind: Partial<Record<MaintenanceKind, number>>;
  currentUsage: number;
  lastServiceUsage: number | undefined;
  lastServiceDate: string | null;
  nextServiceDueUsage: number | undefined;
  usageUntilService: number | undefined;
  serviceDueLevel: ReturnType<typeof serviceDueLevel>;
  isServiceDue: boolean;
}

export interface EquipmentMaintenanceSnapshotInputs {
  equipment: Equipment | undefined;
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildEquipmentMaintenanceSnapshot(
  inputs: EquipmentMaintenanceSnapshotInputs,
): EquipmentMaintenanceSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const eq = inputs.equipment;

  const byKind = new Map<MaintenanceKind, number>();
  let totalEntries = 0;
  let totalCostCents = 0;
  let lastServiceDate: string | null = null;

  for (const entry of eq?.maintenanceLog ?? []) {
    if (entry.performedAt && entry.performedAt.slice(0, 10) > asOf) continue;
    totalEntries += 1;
    byKind.set(entry.kind, (byKind.get(entry.kind) ?? 0) + 1);
    totalCostCents += entry.costCents ?? 0;
    const ymd = entry.performedAt?.slice(0, 10);
    if (ymd && (lastServiceDate == null || ymd > lastServiceDate)) lastServiceDate = ymd;
  }

  const out: Partial<Record<MaintenanceKind, number>> = {};
  for (const [k, v] of byKind) out[k] = v;

  return {
    asOf,
    equipmentId: eq?.id ?? '',
    totalEntries,
    totalCostCents,
    byKind: out,
    currentUsage: eq?.currentUsage ?? 0,
    lastServiceUsage: eq?.lastServiceUsage,
    lastServiceDate,
    nextServiceDueUsage: eq ? nextServiceDueUsage(eq) : undefined,
    usageUntilService: eq ? usageUntilService(eq) : undefined,
    serviceDueLevel: eq ? serviceDueLevel(eq) : 'none',
    isServiceDue: eq ? isServiceDue(eq) : false,
  };
}
