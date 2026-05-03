// Dispatch — daily crew + equipment assignment board.
//
// Each morning Brook + Ryan assign foremen, crew members, and
// equipment to the active jobs for the day. The dispatch board is
// the single yard handout that says "you, you, and you are on
// Sulphur Springs with the 320E and the water truck — meet at
// the yard at 0600."
//
// Phase 1 stores one Dispatch record per (job, day). Phase 2 will
// pull crew rosters + equipment list at assignment time and warn
// when an employee or piece of equipment is double-booked across
// jobs.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const DispatchStatusSchema = z.enum([
  'DRAFT',
  'POSTED',      // shared with foremen
  'COMPLETED',   // day is done
  'CANCELLED',
]);
export type DispatchStatus = z.infer<typeof DispatchStatusSchema>;

export const DispatchCrewMemberSchema = z.object({
  /** Employee id if known. */
  employeeId: z.string().max(120).optional(),
  /** Printed name (always required for the handout). */
  name: z.string().min(1).max(120),
  /** Role on this dispatch (Foreman, Operator, Laborer, Driver, etc.). */
  role: z.string().max(80).optional(),
  /** Free-form notes (PPE, certs, special tasks). */
  note: z.string().max(400).optional(),
});
export type DispatchCrewMember = z.infer<typeof DispatchCrewMemberSchema>;

export const DispatchEquipmentSchema = z.object({
  /** Equipment id if known. */
  equipmentId: z.string().max(120).optional(),
  /** Printed name / unit number (e.g. "CAT 320E", "Service Truck #2"). */
  name: z.string().min(1).max(120),
  /** Operator name (cross-references crew member). */
  operatorName: z.string().max(120).optional(),
  /** Free-form notes. */
  note: z.string().max(400).optional(),
});
export type DispatchEquipment = z.infer<typeof DispatchEquipmentSchema>;

export const DispatchSchema = z.object({
  /** Stable id `disp-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Day of the dispatch (yyyy-mm-dd). */
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

  /** Foreman name printed at the top of the handout. */
  foremanName: z.string().min(1).max(120),
  /** Foreman phone for the handout. */
  foremanPhone: z.string().max(40).optional(),

  /** Yard meet time, free-form ("0600", "06:00", "6 AM"). */
  meetTime: z.string().max(20).optional(),
  /** Where to meet (yard, jobsite, etc.). */
  meetLocation: z.string().max(200).optional(),
  /** Scope of work for the day. */
  scopeOfWork: z.string().max(4_000),
  /** Special instructions / safety topics for the day. */
  specialInstructions: z.string().max(4_000).optional(),

  crew: z.array(DispatchCrewMemberSchema).default([]),
  equipment: z.array(DispatchEquipmentSchema).default([]),

  status: DispatchStatusSchema.default('DRAFT'),
  /** Time the dispatch was posted to the foremen. */
  postedAt: z.string().optional(),
  /** Time the day was marked complete. */
  completedAt: z.string().optional(),

  notes: z.string().max(10_000).optional(),
});
export type Dispatch = z.infer<typeof DispatchSchema>;

export const DispatchCreateSchema = DispatchSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: DispatchStatusSchema.optional(),
  crew: z.array(DispatchCrewMemberSchema).optional(),
  equipment: z.array(DispatchEquipmentSchema).optional(),
});
export type DispatchCreate = z.infer<typeof DispatchCreateSchema>;

export const DispatchPatchSchema = DispatchCreateSchema.partial();
export type DispatchPatch = z.infer<typeof DispatchPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function dispatchStatusLabel(s: DispatchStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `dispatch.status.${s}`);
}

export interface DoubleBooking {
  /** Day the conflict occurs on. */
  scheduledFor: string;
  /** Free-form name of the resource that's double-booked. */
  name: string;
  /** Resource kind. */
  kind: 'CREW' | 'EQUIPMENT';
  /** All dispatches that have this resource assigned. */
  dispatchIds: string[];
}

/**
 * Detect when the same employee or piece of equipment is on more than
 * one dispatch on the same day. Resource identity is by employeeId /
 * equipmentId where present, falling back to a normalized `name` match.
 */
export function detectDoubleBookings(dispatches: Dispatch[]): DoubleBooking[] {
  const byDay = new Map<string, Dispatch[]>();
  for (const d of dispatches) {
    if (d.status === 'CANCELLED') continue;
    const key = d.scheduledFor;
    const list = byDay.get(key) ?? [];
    list.push(d);
    byDay.set(key, list);
  }

  const conflicts: DoubleBooking[] = [];
  for (const [scheduledFor, dayDispatches] of byDay) {
    if (dayDispatches.length < 2) continue;

    // crew side
    const crewMap = new Map<string, { name: string; ids: Set<string> }>();
    for (const d of dayDispatches) {
      for (const c of d.crew) {
        const key = (c.employeeId ?? c.name.trim().toLowerCase());
        if (!key) continue;
        const entry = crewMap.get(key) ?? { name: c.name, ids: new Set() };
        entry.ids.add(d.id);
        crewMap.set(key, entry);
      }
    }
    for (const { name, ids } of crewMap.values()) {
      if (ids.size > 1) {
        conflicts.push({
          scheduledFor,
          name,
          kind: 'CREW',
          dispatchIds: Array.from(ids).sort(),
        });
      }
    }

    // equipment side
    const eqMap = new Map<string, { name: string; ids: Set<string> }>();
    for (const d of dayDispatches) {
      for (const e of d.equipment) {
        const key = (e.equipmentId ?? e.name.trim().toLowerCase());
        if (!key) continue;
        const entry = eqMap.get(key) ?? { name: e.name, ids: new Set() };
        entry.ids.add(d.id);
        eqMap.set(key, entry);
      }
    }
    for (const { name, ids } of eqMap.values()) {
      if (ids.size > 1) {
        conflicts.push({
          scheduledFor,
          name,
          kind: 'EQUIPMENT',
          dispatchIds: Array.from(ids).sort(),
        });
      }
    }
  }

  return conflicts.sort((a, b) =>
    a.scheduledFor === b.scheduledFor
      ? a.name.localeCompare(b.name)
      : a.scheduledFor.localeCompare(b.scheduledFor),
  );
}

export interface DispatchRollup {
  total: number;
  draft: number;
  posted: number;
  completed: number;
  cancelled: number;
  /** Number of dispatches scheduled for today. */
  todayCount: number;
  /** Total crew assigned today. */
  todayCrewHeadcount: number;
  /** Total equipment assigned today. */
  todayEquipmentCount: number;
  /** Resources double-booked on any day in the set. */
  doubleBookings: number;
}

export function computeDispatchRollup(
  dispatches: Dispatch[],
  asOfDate?: string,
): DispatchRollup {
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);
  let draft = 0;
  let posted = 0;
  let completed = 0;
  let cancelled = 0;
  let todayCount = 0;
  let todayCrewHeadcount = 0;
  let todayEquipmentCount = 0;
  for (const d of dispatches) {
    if (d.status === 'DRAFT') draft += 1;
    else if (d.status === 'POSTED') posted += 1;
    else if (d.status === 'COMPLETED') completed += 1;
    else if (d.status === 'CANCELLED') cancelled += 1;
    if (d.scheduledFor === today && d.status !== 'CANCELLED') {
      todayCount += 1;
      todayCrewHeadcount += d.crew.length;
      todayEquipmentCount += d.equipment.length;
    }
  }
  return {
    total: dispatches.length,
    draft,
    posted,
    completed,
    cancelled,
    todayCount,
    todayCrewHeadcount,
    todayEquipmentCount,
    doubleBookings: detectDoubleBookings(dispatches).length,
  };
}

export function newDispatchId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `disp-${hex.padStart(8, '0')}`;
}
