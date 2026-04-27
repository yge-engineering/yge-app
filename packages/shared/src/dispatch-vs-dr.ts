// Dispatch vs Daily-Report reconciliation.
//
// Plain English: the dispatch board says "Sulphur Springs, Tuesday,
// foreman Lopez, 6 crew." If we POSTED that dispatch but no daily
// report ever showed up for (Sulphur Springs, Tuesday), there's a
// hole in the record. Either the foreman forgot to submit, or worse,
// they actually didn't work that day and nobody told the office.
//
// Conversely, if a daily report shows up for a job + day where no
// dispatch was POSTED, that's a side-quest the office didn't sign
// off on.
//
// This pure-derivation module joins POSTED dispatches against
// submitted daily reports on (jobId, date) and surfaces the misses.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';

export type DispatchDrFlag =
  | 'MATCH'              // posted dispatch + submitted DR for same (job, date)
  | 'MISSING_DR'         // posted dispatch, no submitted DR
  | 'MISSING_DISPATCH'   // submitted DR, no POSTED dispatch
  | 'DISPATCH_DRAFT';    // dispatch existed but never POSTED, and no DR

export interface DispatchDrRow {
  jobId: string;
  date: string;
  dispatchId: string | null;
  dispatchStatus: Dispatch['status'] | null;
  dailyReportId: string | null;
  flag: DispatchDrFlag;
}

export interface DispatchDrRollup {
  pairsConsidered: number;
  match: number;
  missingDr: number;
  missingDispatch: number;
  dispatchDraft: number;
}

export interface DispatchDrInputs {
  fromDate?: string;
  toDate?: string;
  dispatches: Dispatch[];
  dailyReports: DailyReport[];
}

export function buildDispatchVsDr(inputs: DispatchDrInputs): {
  rollup: DispatchDrRollup;
  rows: DispatchDrRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // (jobId|date) -> dispatch (preferring POSTED over DRAFT/CANCELLED).
  const dispByKey = new Map<string, Dispatch>();
  for (const d of inputs.dispatches) {
    if (!inRange(d.scheduledFor)) continue;
    const key = `${d.jobId}|${d.scheduledFor}`;
    const existing = dispByKey.get(key);
    if (!existing) dispByKey.set(key, d);
    else {
      // Prefer POSTED > COMPLETED > DRAFT > CANCELLED when there are dupes.
      const rank: Record<Dispatch['status'], number> = {
        POSTED: 0,
        COMPLETED: 1,
        DRAFT: 2,
        CANCELLED: 3,
      };
      if (rank[d.status] < rank[existing.status]) {
        dispByKey.set(key, d);
      }
    }
  }

  const drByKey = new Map<string, DailyReport>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    const key = `${dr.jobId}|${dr.date}`;
    drByKey.set(key, dr);
  }

  const allKeys = new Set<string>([...dispByKey.keys(), ...drByKey.keys()]);
  const rows: DispatchDrRow[] = [];
  let match = 0;
  let missingDr = 0;
  let missingDispatch = 0;
  let dispatchDraft = 0;

  for (const key of allKeys) {
    const parts = key.split('|');
    const jobId = parts[0] ?? '';
    const date = parts[1] ?? '';
    const disp = dispByKey.get(key) ?? null;
    const dr = drByKey.get(key) ?? null;

    let flag: DispatchDrFlag;
    if (disp && (disp.status === 'POSTED' || disp.status === 'COMPLETED') && dr) {
      flag = 'MATCH';
      match += 1;
    } else if (disp && (disp.status === 'POSTED' || disp.status === 'COMPLETED') && !dr) {
      flag = 'MISSING_DR';
      missingDr += 1;
    } else if (!disp && dr) {
      flag = 'MISSING_DISPATCH';
      missingDispatch += 1;
    } else {
      // dispatch exists but DRAFT/CANCELLED; no DR
      flag = 'DISPATCH_DRAFT';
      dispatchDraft += 1;
    }

    rows.push({
      jobId,
      date,
      dispatchId: disp?.id ?? null,
      dispatchStatus: disp?.status ?? null,
      dailyReportId: dr?.id ?? null,
      flag,
    });
  }

  // Most actionable first: MISSING_DR (foreman forgot) > MISSING_DISPATCH > DRAFT > MATCH.
  const tierRank: Record<DispatchDrFlag, number> = {
    MISSING_DR: 0,
    MISSING_DISPATCH: 1,
    DISPATCH_DRAFT: 2,
    MATCH: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.jobId.localeCompare(b.jobId);
  });

  return {
    rollup: {
      pairsConsidered: rows.length,
      match,
      missingDr,
      missingDispatch,
      dispatchDraft,
    },
    rows,
  };
}
