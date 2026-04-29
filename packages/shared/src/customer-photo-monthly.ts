// Per (customer, month) photo evidence rollup.
//
// Plain English: join photos to customers via Job → ownerAgency,
// then bucket by (customerName, yyyy-mm of takenOn). Counts
// photos, breaks down by category (PROGRESS / DELAY /
// CHANGE_ORDER / SWPPP / INCIDENT / etc.), distinct jobs.
// Surfaces photo evidence cadence per agency client — useful
// when CAL FIRE asks "send me everything from April on
// Sulphur Springs."
//
// Per row: customerName, month, total, byCategory, distinctJobs,
// distinctPhotographers.
//
// Sort: customerName asc, month asc.
//
// Different from photo-by-month (portfolio per month),
// photo-evidence-by-job-monthly (per job per month),
// customer-co-monthly / customer-pco-monthly / customer-rfi-
// monthly / customer-submittal-monthly / customer-incident-
// monthly (other customer-anchored monthly views).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Photo, PhotoCategory } from './photo';

export interface CustomerPhotoMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  byCategory: Partial<Record<PhotoCategory, number>>;
  distinctJobs: number;
  distinctPhotographers: number;
}

export interface CustomerPhotoMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalPhotos: number;
  unattributed: number;
}

export interface CustomerPhotoMonthlyInputs {
  photos: Photo[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to takenOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerPhotoMonthly(
  inputs: CustomerPhotoMonthlyInputs,
): {
  rollup: CustomerPhotoMonthlyRollup;
  rows: CustomerPhotoMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    byCategory: Map<PhotoCategory, number>;
    jobs: Set<string>;
    photographers: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalPhotos = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.photos) {
    const month = p.takenOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(p.jobId);
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        total: 0,
        byCategory: new Map(),
        jobs: new Set(),
        photographers: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    const cat: PhotoCategory = p.category ?? 'OTHER';
    a.byCategory.set(cat, (a.byCategory.get(cat) ?? 0) + 1);
    a.jobs.add(p.jobId);
    if (p.photographerName) a.photographers.add(p.photographerName);

    customers.add(cKey);
    months.add(month);
    totalPhotos += 1;
  }

  const rows: CustomerPhotoMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCategory: Partial<Record<PhotoCategory, number>> = {};
      for (const [k, v] of a.byCategory) byCategory[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        total: a.total,
        byCategory,
        distinctJobs: a.jobs.size,
        distinctPhotographers: a.photographers.size,
      };
    })
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalPhotos,
      unattributed,
    },
    rows,
  };
}
