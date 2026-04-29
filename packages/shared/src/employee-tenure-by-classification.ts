// Employee tenure rolled up by classification.
//
// Plain English: per DIR classification (OPERATING_ENGINEER_*,
// LABORER_*, TEAMSTER_*, etc.), how many active employees do
// we have and how long do they stay? "My Operating Engineers
// average 7.5 years, my Laborers average 1.8 years" tells YGE
// where retention is working and where it's a revolving door.
//
// Tenure source: hiredOn (yyyy-mm-dd) when present, createdAt
// fallback otherwise.
//
// Per row: classification, count, meanDays, medianDays, minDays,
// maxDays, newHire90DayCount.
//
// Sort: count desc, then classification asc.
//
// Different from employee-tenure (per-employee tier),
// employee-tenure-buckets (bucket histogram with classification
// mix per bucket). This swaps the axes — classification is the
// row, tenure stats are the columns.
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
  EmploymentStatus,
} from './employee';

export interface EmployeeTenureByClassificationRow {
  classification: DirClassification;
  count: number;
  meanDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  newHire90DayCount: number;
}

export interface EmployeeTenureByClassificationRollup {
  classificationsConsidered: number;
  totalActive: number;
  excludedByStatus: number;
  meanDaysOverall: number;
}

export interface EmployeeTenureByClassificationInputs {
  employees: Employee[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
  /** Statuses to include. Defaults to ['ACTIVE']. */
  includeStatuses?: EmploymentStatus[];
}

const MS_PER_DAY = 86_400_000;

function startDate(e: Employee): Date {
  if (e.hiredOn && /^\d{4}-\d{2}-\d{2}$/.test(e.hiredOn)) {
    return new Date(`${e.hiredOn}T00:00:00Z`);
  }
  return new Date(e.createdAt);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function buildEmployeeTenureByClassification(
  inputs: EmployeeTenureByClassificationInputs,
): {
  rollup: EmployeeTenureByClassificationRollup;
  rows: EmployeeTenureByClassificationRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  const include: EmploymentStatus[] = inputs.includeStatuses ?? ['ACTIVE'];
  const includeSet = new Set(include);

  type Acc = {
    classification: DirClassification;
    days: number[];
    newHire90: number;
  };
  const accs = new Map<DirClassification, Acc>();
  let excludedByStatus = 0;
  let totalDays = 0;
  let totalActive = 0;

  for (const e of inputs.employees) {
    const status = e.status ?? 'ACTIVE';
    if (!includeSet.has(status)) {
      excludedByStatus += 1;
      continue;
    }
    const klass: DirClassification = e.classification ?? 'NOT_APPLICABLE';
    const start = startDate(e);
    const days = Math.max(
      0,
      Math.floor((asOf.getTime() - start.getTime()) / MS_PER_DAY),
    );

    let a = accs.get(klass);
    if (!a) {
      a = { classification: klass, days: [], newHire90: 0 };
      accs.set(klass, a);
    }
    a.days.push(days);
    if (days < 90) a.newHire90 += 1;

    totalDays += days;
    totalActive += 1;
  }

  const rows: EmployeeTenureByClassificationRow[] = [];
  for (const a of accs.values()) {
    const sorted = [...a.days].sort((x, y) => x - y);
    const sum = sorted.reduce((s, n) => s + n, 0);
    rows.push({
      classification: a.classification,
      count: sorted.length,
      meanDays: sorted.length > 0 ? Math.round(sum / sorted.length) : 0,
      medianDays: Math.round(median(sorted)),
      minDays: sorted[0] ?? 0,
      maxDays: sorted[sorted.length - 1] ?? 0,
      newHire90DayCount: a.newHire90,
    });
  }

  rows.sort((x, y) => {
    if (y.count !== x.count) return y.count - x.count;
    return x.classification.localeCompare(y.classification);
  });

  return {
    rollup: {
      classificationsConsidered: rows.length,
      totalActive,
      excludedByStatus,
      meanDaysOverall:
        totalActive > 0 ? Math.round(totalDays / totalActive) : 0,
    },
    rows,
  };
}
