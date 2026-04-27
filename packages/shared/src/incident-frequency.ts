// Incident frequency analysis (TRIR + DART proxy + employee/job repeat-offender map).
//
// Plain English: which crews and which jobs are getting hurt most?
// Cal/OSHA + EMR carriers care about this. The audit version of
// these stats lives on the Form 300A annual summary; this module
// gives the interim, ongoing view so safety meetings can target
// real patterns.
//
// Three views:
//   - Per-employee count + most-recent incident date (filters DEATH
//     out of "repeat offender" definition since one fatal incident
//     ends the conversation)
//   - Per-job count + days-away total
//   - Rollup with TRIR proxy (recordable * 200,000 / total hours
//     worked) when total hours are supplied
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface IncidentByEmployee {
  employeeId: string | null;
  employeeName: string;
  incidentCount: number;
  daysAwayTotal: number;
  daysRestrictedTotal: number;
  /** Most recent incidentDate (yyyy-mm-dd). */
  lastIncidentDate: string;
}

export interface IncidentByJob {
  jobId: string;
  incidentCount: number;
  daysAwayTotal: number;
  daysRestrictedTotal: number;
}

export interface IncidentFrequencyRollup {
  totalIncidents: number;
  fatalCount: number;
  daysAwayCount: number;
  jobTransferCount: number;
  otherRecordableCount: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  /** TRIR (Total Recordable Incident Rate) — recordable * 200_000 /
   *  total hours worked. Returns null when totalHoursWorked not
   *  supplied (Phase 2 will pull from time cards automatically). */
  trir: number | null;
  /** DART rate (Days Away/Restricted/Transfer) — same formula but
   *  numerator only counts incidents with daysAway+daysRestricted>0
   *  or outcome JOB_TRANSFER_OR_RESTRICTION. Null without hours. */
  dartRate: number | null;
}

export interface IncidentFrequencyInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  incidents: Incident[];
  /** Total hours worked across the company in the window. Phase 2
   *  derives this from time cards. */
  totalHoursWorked?: number;
}

export function buildIncidentFrequency(inputs: IncidentFrequencyInputs): {
  rollup: IncidentFrequencyRollup;
  byEmployee: IncidentByEmployee[];
  byJob: IncidentByJob[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  const byEmpMap = new Map<string, IncidentByEmployee>();
  const byJobMap = new Map<string, IncidentByJob>();

  let total = 0;
  let fatal = 0;
  let daysAway = 0;
  let jobTransfer = 0;
  let other = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let dartNumerator = 0;

  for (const inc of inputs.incidents) {
    if (!inRange(inc.incidentDate)) continue;
    total += 1;

    switch (inc.outcome) {
      case 'DEATH': fatal += 1; break;
      case 'DAYS_AWAY': daysAway += 1; break;
      case 'JOB_TRANSFER_OR_RESTRICTION': jobTransfer += 1; break;
      case 'OTHER_RECORDABLE': other += 1; break;
    }
    totalDaysAway += inc.daysAway;
    totalDaysRestricted += inc.daysRestricted;

    if (
      inc.outcome === 'JOB_TRANSFER_OR_RESTRICTION' ||
      inc.daysAway > 0 ||
      inc.daysRestricted > 0
    ) {
      dartNumerator += 1;
    }

    // Employee bucket
    const empKey = inc.employeeId ?? `name:${inc.employeeName.trim().toLowerCase()}`;
    const e = byEmpMap.get(empKey) ?? {
      employeeId: inc.employeeId ?? null,
      employeeName: inc.employeeName,
      incidentCount: 0,
      daysAwayTotal: 0,
      daysRestrictedTotal: 0,
      lastIncidentDate: inc.incidentDate,
    };
    e.incidentCount += 1;
    e.daysAwayTotal += inc.daysAway;
    e.daysRestrictedTotal += inc.daysRestricted;
    if (inc.incidentDate > e.lastIncidentDate) e.lastIncidentDate = inc.incidentDate;
    byEmpMap.set(empKey, e);

    // Job bucket (skip when not associated with a job)
    if (inc.jobId) {
      const j = byJobMap.get(inc.jobId) ?? {
        jobId: inc.jobId,
        incidentCount: 0,
        daysAwayTotal: 0,
        daysRestrictedTotal: 0,
      };
      j.incidentCount += 1;
      j.daysAwayTotal += inc.daysAway;
      j.daysRestrictedTotal += inc.daysRestricted;
      byJobMap.set(inc.jobId, j);
    }
  }

  const byEmployee = Array.from(byEmpMap.values()).sort(
    (a, b) => b.incidentCount - a.incidentCount,
  );
  const byJob = Array.from(byJobMap.values()).sort(
    (a, b) => b.incidentCount - a.incidentCount,
  );

  const trir =
    inputs.totalHoursWorked && inputs.totalHoursWorked > 0
      ? round2((total * 200_000) / inputs.totalHoursWorked)
      : null;
  const dartRate =
    inputs.totalHoursWorked && inputs.totalHoursWorked > 0
      ? round2((dartNumerator * 200_000) / inputs.totalHoursWorked)
      : null;

  return {
    rollup: {
      totalIncidents: total,
      fatalCount: fatal,
      daysAwayCount: daysAway,
      jobTransferCount: jobTransfer,
      otherRecordableCount: other,
      totalDaysAway,
      totalDaysRestricted,
      trir,
      dartRate,
    },
    byEmployee,
    byJob,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
