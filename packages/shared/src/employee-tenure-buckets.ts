// Employee tenure buckets across the active workforce.
//
// Plain English: roll the active employee roster up by tenure
// bucket — UNDER_90D, UNDER_1Y, ONE_TO_3, THREE_TO_5, FIVE_PLUS.
// Different from employee-tenure (per-employee tier card) — this
// is the portfolio histogram for the workforce review.
//
// Tenure measured from hiredOn (yyyy-mm-dd) when present,
// createdAt fallback otherwise.
//
// Per row: bucket, label, count, byClassification mix.
//
// Sort: UNDER_90D → UNDER_1Y → ONE_TO_3 → THREE_TO_5 → FIVE_PLUS.
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
  EmploymentStatus,
} from './employee';

export type TenureBucketKey =
  | 'UNDER_90D'
  | 'UNDER_1Y'
  | 'ONE_TO_3'
  | 'THREE_TO_5'
  | 'FIVE_PLUS';

export interface EmployeeTenureBucketRow {
  bucket: TenureBucketKey;
  label: string;
  count: number;
  byClassification: Partial<Record<DirClassification, number>>;
}

export interface EmployeeTenureBucketsRollup {
  bucketsConsidered: number;
  totalActive: number;
  excludedByStatus: number;
}

export interface EmployeeTenureBucketsInputs {
  employees: Employee[];
  /** Reference 'now'. Defaults to today. */
  asOf?: Date;
  /** Statuses to include. Defaults to ['ACTIVE']. */
  includeStatuses?: EmploymentStatus[];
}

const ORDER: TenureBucketKey[] = ['UNDER_90D', 'UNDER_1Y', 'ONE_TO_3', 'THREE_TO_5', 'FIVE_PLUS'];
const LABELS: Record<TenureBucketKey, string> = {
  UNDER_90D: '< 90 days',
  UNDER_1Y: '90 days – 1 year',
  ONE_TO_3: '1 – 3 years',
  THREE_TO_5: '3 – 5 years',
  FIVE_PLUS: '5+ years',
};

export function buildEmployeeTenureBuckets(
  inputs: EmployeeTenureBucketsInputs,
): {
  rollup: EmployeeTenureBucketsRollup;
  rows: EmployeeTenureBucketRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  const include = inputs.includeStatuses ?? ['ACTIVE'];
  const includeSet = new Set(include);

  type Acc = {
    count: number;
    classes: Map<DirClassification, number>;
  };
  const accs = new Map<TenureBucketKey, Acc>();
  for (const k of ORDER) accs.set(k, { count: 0, classes: new Map() });
  let totalActive = 0;
  let excluded = 0;

  for (const e of inputs.employees) {
    if (!includeSet.has(e.status)) {
      excluded += 1;
      continue;
    }
    const startStr = (e.hiredOn ?? e.createdAt.slice(0, 10)).slice(0, 10);
    const start = Date.parse(startStr + 'T00:00:00Z');
    if (Number.isNaN(start)) {
      excluded += 1;
      continue;
    }
    const days = Math.floor((asOf.getTime() - start) / 86_400_000);
    const bucket = bucketize(days);
    const acc = accs.get(bucket)!;
    acc.count += 1;
    acc.classes.set(e.classification, (acc.classes.get(e.classification) ?? 0) + 1);
    totalActive += 1;
  }

  const rows: EmployeeTenureBucketRow[] = [];
  for (const bucket of ORDER) {
    const acc = accs.get(bucket);
    if (!acc) continue;
    const obj: Partial<Record<DirClassification, number>> = {};
    for (const [k, v] of acc.classes.entries()) obj[k] = v;
    rows.push({
      bucket,
      label: LABELS[bucket],
      count: acc.count,
      byClassification: obj,
    });
  }

  return {
    rollup: {
      bucketsConsidered: rows.length,
      totalActive,
      excludedByStatus: excluded,
    },
    rows,
  };
}

function bucketize(days: number): TenureBucketKey {
  if (days < 90) return 'UNDER_90D';
  if (days < 365) return 'UNDER_1Y';
  if (days < 365 * 3) return 'ONE_TO_3';
  if (days < 365 * 5) return 'THREE_TO_5';
  return 'FIVE_PLUS';
}
