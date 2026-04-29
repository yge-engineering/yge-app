// Per (customer, month) equipment dispatch rollup.
//
// Plain English: for each POSTED + COMPLETED dispatch, walk
// the equipment lines, join the dispatch's jobId to a customer
// via Job → ownerAgency, then bucket by (customerName, yyyy-mm
// of scheduledFor). Counts equipment lines, distinct units,
// distinct dispatch days, distinct jobs. Drives the
// customer-side equipment-rebill summary.
//
// Per row: customerName, month, equipmentLines, distinctUnits,
// distinctDates, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from job-equipment-monthly (per job axis),
// dispatch-equipment-monthly (portfolio per category per month),
// equipment-utilization-monthly (per unit per month).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface CustomerEquipmentMonthlyRow {
  customerName: string;
  month: string;
  equipmentLines: number;
  distinctUnits: number;
  distinctDates: number;
  distinctJobs: number;
}

export interface CustomerEquipmentMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalLines: number;
  draftSkipped: number;
  cancelledSkipped: number;
  unattributed: number;
}

export interface CustomerEquipmentMonthlyInputs {
  dispatches: Dispatch[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to scheduledFor. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerEquipmentMonthly(
  inputs: CustomerEquipmentMonthlyInputs,
): {
  rollup: CustomerEquipmentMonthlyRollup;
  rows: CustomerEquipmentMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    lines: number;
    units: Set<string>;
    dates: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalLines = 0;
  let draftSkipped = 0;
  let cancelledSkipped = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const d of inputs.dispatches) {
    const status = d.status ?? 'DRAFT';
    if (status === 'DRAFT') {
      draftSkipped += 1;
      continue;
    }
    if (status === 'CANCELLED') {
      cancelledSkipped += 1;
      continue;
    }
    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(d.jobId);
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
        lines: 0,
        units: new Set(),
        dates: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    for (const e of d.equipment ?? []) {
      a.lines += 1;
      const unitKey = e.equipmentId ?? `name:${e.name.toLowerCase().trim()}`;
      a.units.add(unitKey);
      a.dates.add(d.scheduledFor);
      a.jobs.add(d.jobId);
      totalLines += 1;
    }

    customers.add(cKey);
    months.add(month);
  }

  const rows: CustomerEquipmentMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      equipmentLines: a.lines,
      distinctUnits: a.units.size,
      distinctDates: a.dates.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalLines,
      draftSkipped,
      cancelledSkipped,
      unattributed,
    },
    rows,
  };
}
