// Apprenticeship ratio audit (CA DIR §230.1).
//
// Plain English: California Code of Regulations Title 8, §230.1
// requires public-works contractors to use registered apprentices
// at a 1:5 ratio (one apprentice hour for every five journey hours)
// per craft, on every job over $30,000. Skip the ratio without a
// pre-approved exception and DIR can pull a substantial penalty +
// debar the contractor.
//
// This walks certified payroll records for a job, splits hours by
// classification (proxy for craft) AND apprentice/journey status
// (resolved via the Employee record), then flags crafts that don't
// hit 1:5.
//
// Pure derivation. No persisted records.

import type { CertifiedPayroll, CprEmployeeRow } from './certified-payroll';
import type { DirClassification, Employee, EmployeeRole } from './employee';

export const DEFAULT_RATIO_THRESHOLD = 1 / 5;

export type ApprenticeStatus = 'JOURNEY' | 'APPRENTICE' | 'UNKNOWN';

export interface ApprenticeRatioCraftRow {
  classification: DirClassification;
  /** Sum of straight + OT hours by status. */
  journeyHours: number;
  apprenticeHours: number;
  unknownHours: number;
  /** apprenticeHours / max(journeyHours, 1). */
  actualRatio: number;
  /** apprenticeHours required to reach 1:5 ratio at current journey
   *  hours. ceil(journey * threshold) - apprentice (clamped >= 0). */
  shortfallHours: number;
  /** True iff actualRatio >= threshold. */
  compliant: boolean;
}

export interface ApprenticeRatioReport {
  jobId: string;
  cprsConsidered: number;
  totalJourneyHours: number;
  totalApprenticeHours: number;
  totalUnknownHours: number;
  /** apprentice / journey across the job. */
  blendedRatio: number;
  blendedCompliant: boolean;
  byCraft: ApprenticeRatioCraftRow[];
  /** Per-employee whose role couldn't be resolved (no Employee match
   *  for the row's employeeId). The audit pretended these are JOURNEY
   *  but the caller may want to flag them as data-quality gaps. */
  unresolvedEmployeeIds: string[];
}

export interface ApprenticeRatioInputs {
  jobId: string;
  certifiedPayrolls: CertifiedPayroll[];
  employees: Employee[];
  /** Override the 1:5 default if the apprenticeship committee
   *  approved a different ratio. */
  ratioThreshold?: number;
}

export function buildApprenticeshipRatioAudit(
  inputs: ApprenticeRatioInputs,
): ApprenticeRatioReport {
  const threshold = inputs.ratioThreshold ?? DEFAULT_RATIO_THRESHOLD;

  // Index role by employeeId.
  const roleById = new Map<string, EmployeeRole>();
  for (const e of inputs.employees) roleById.set(e.id, e.role);

  // Filter CPRs: this job, status not DRAFT.
  const cprs = inputs.certifiedPayrolls.filter(
    (c) => c.jobId === inputs.jobId && c.status !== 'DRAFT',
  );

  type Bucket = {
    journey: number;
    apprentice: number;
    unknown: number;
  };
  const byCraft = new Map<DirClassification, Bucket>();
  const unresolvedEmployeeIds = new Set<string>();
  let totalJourney = 0;
  let totalApprentice = 0;
  let totalUnknown = 0;

  for (const cpr of cprs) {
    for (const row of cpr.rows) {
      const hours = (row.straightHours ?? 0) + (row.overtimeHours ?? 0);
      if (hours <= 0) continue;
      const status = classifyRow(row, roleById);
      if (status === 'UNKNOWN') unresolvedEmployeeIds.add(row.employeeId);
      const b =
        byCraft.get(row.classification) ??
        ({ journey: 0, apprentice: 0, unknown: 0 } as Bucket);
      if (status === 'JOURNEY') {
        b.journey += hours;
        totalJourney += hours;
      } else if (status === 'APPRENTICE') {
        b.apprentice += hours;
        totalApprentice += hours;
      } else {
        // Treat unknown as journey for ratio math (most punitive
        // assumption — they need an apprentice to balance them).
        b.unknown += hours;
        b.journey += hours;
        totalUnknown += hours;
        totalJourney += hours;
      }
      byCraft.set(row.classification, b);
    }
  }

  const rows: ApprenticeRatioCraftRow[] = [];
  for (const [classification, b] of byCraft) {
    const denom = Math.max(1, b.journey);
    const actualRatio = b.apprentice / denom;
    const required = Math.ceil(b.journey * threshold);
    const shortfallHours = Math.max(0, required - b.apprentice);
    rows.push({
      classification,
      journeyHours: round2(b.journey),
      apprenticeHours: round2(b.apprentice),
      unknownHours: round2(b.unknown),
      actualRatio: round4(actualRatio),
      shortfallHours: round2(shortfallHours),
      compliant: actualRatio >= threshold,
    });
  }

  // Worst compliance first (largest shortfall first).
  rows.sort((a, b) => b.shortfallHours - a.shortfallHours);

  const blendedRatio = totalJourney === 0 ? 0 : totalApprentice / totalJourney;

  return {
    jobId: inputs.jobId,
    cprsConsidered: cprs.length,
    totalJourneyHours: round2(totalJourney),
    totalApprenticeHours: round2(totalApprentice),
    totalUnknownHours: round2(totalUnknown),
    blendedRatio: round4(blendedRatio),
    blendedCompliant: blendedRatio >= threshold,
    byCraft: rows,
    unresolvedEmployeeIds: Array.from(unresolvedEmployeeIds).sort(),
  };
}

function classifyRow(
  row: CprEmployeeRow,
  roleById: Map<string, EmployeeRole>,
): ApprenticeStatus {
  const role = roleById.get(row.employeeId);
  if (!role) return 'UNKNOWN';
  if (role === 'APPRENTICE') return 'APPRENTICE';
  // Owner / office / project-manager hours don't count as journey
  // for ratio math — they're not in the trade. But CPR rows for
  // those people shouldn't exist anyway. Treat as UNKNOWN to
  // surface the data anomaly.
  if (role === 'OWNER' || role === 'OFFICE' || role === 'PROJECT_MANAGER') {
    return 'UNKNOWN';
  }
  return 'JOURNEY';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
