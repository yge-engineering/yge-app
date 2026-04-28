// Per-job equipment-days from dispatches.
//
// Plain English: for each AWARDED job, walk the dispatch history
// and count how many distinct days each piece of equipment was
// dispatched to that job. Per row per job: a list of equipment
// entries (name, equipmentId, distinct dispatched days), total
// equipment-days summed.
//
// Different from job-equipment-cost (\$ from rates) and
// equipment-dispatch-days (per-equipment portfolio rollup). This
// is the per-job equipment usage map.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface JobEquipmentEntry {
  equipmentId: string | null;
  name: string;
  distinctDays: number;
}

export interface JobEquipmentDaysRow {
  jobId: string;
  projectName: string;
  totalEquipmentDays: number;
  distinctEquipmentCount: number;
  equipment: JobEquipmentEntry[];
}

export interface JobEquipmentDaysRollup {
  jobsConsidered: number;
  totalEquipmentDays: number;
}

export interface JobEquipmentDaysInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  dispatches: Dispatch[];
  /** Inclusive yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
}

export function buildJobEquipmentDays(
  inputs: JobEquipmentDaysInputs,
): {
  rollup: JobEquipmentDaysRollup;
  rows: JobEquipmentDaysRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Map<jobId, Map<key, { equipmentId, name, days: Set<string> }>>
  const accs = new Map<string, Map<string, {
    equipmentId: string | null;
    name: string;
    days: Set<string>;
  }>>();

  for (const d of inputs.dispatches) {
    if (d.status === 'DRAFT' || d.status === 'CANCELLED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    const jobAcc = accs.get(d.jobId) ?? new Map();
    for (const eq of d.equipment) {
      const key = eq.equipmentId ?? `name:${canonicalize(eq.name)}`;
      const entry = jobAcc.get(key) ?? {
        equipmentId: eq.equipmentId ?? null,
        name: eq.name,
        days: new Set<string>(),
      };
      entry.days.add(d.scheduledFor);
      jobAcc.set(key, entry);
    }
    accs.set(d.jobId, jobAcc);
  }

  let totalDays = 0;
  const rows: JobEquipmentDaysRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const acc = accs.get(j.id) ?? new Map();
    const equipment: JobEquipmentEntry[] = [];
    let jobTotalDays = 0;
    for (const entry of acc.values()) {
      const days = entry.days.size;
      equipment.push({
        equipmentId: entry.equipmentId,
        name: entry.name,
        distinctDays: days,
      });
      jobTotalDays += days;
    }
    equipment.sort((a, b) => {
      if (a.distinctDays !== b.distinctDays) return b.distinctDays - a.distinctDays;
      return a.name.localeCompare(b.name);
    });

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      totalEquipmentDays: jobTotalDays,
      distinctEquipmentCount: equipment.length,
      equipment,
    });

    totalDays += jobTotalDays;
  }

  // Sort jobs by totalEquipmentDays desc.
  rows.sort((a, b) => b.totalEquipmentDays - a.totalEquipmentDays);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalEquipmentDays: totalDays,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}
