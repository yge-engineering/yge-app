// Per (customer, month) incident activity rollup.
//
// Plain English: join incidents to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// incidentDate). Counts incidents, breaks down by
// IncidentClassification, sums daysAway + daysRestricted.
// Tells YGE if a particular agency's job sites are running
// hot on safety incidents.
//
// Per row: customerName, month, total, byClassification,
// totalDaysAway, totalDaysRestricted, distinctJobs,
// distinctEmployees.
//
// Sort: customerName asc, month asc.
//
// Different from incident-monthly-by-job (per job axis),
// incident-by-classification (portfolio per class),
// incident-by-employee (per employee), incident-by-outcome-
// monthly (portfolio per outcome).
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification } from './incident';
import type { Job } from './job';

export interface CustomerIncidentMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctJobs: number;
  distinctEmployees: number;
}

export interface CustomerIncidentMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  unattributed: number;
}

export interface CustomerIncidentMonthlyInputs {
  incidents: Incident[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to incidentDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerIncidentMonthly(
  inputs: CustomerIncidentMonthlyInputs,
): {
  rollup: CustomerIncidentMonthlyRollup;
  rows: CustomerIncidentMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    byClassification: Map<IncidentClassification, number>;
    daysAway: number;
    daysRestricted: number;
    jobs: Set<string>;
    employees: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = inc.jobId ? jobCustomer.get(inc.jobId) : undefined;
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
        byClassification: new Map(),
        daysAway: 0,
        daysRestricted: 0,
        jobs: new Set(),
        employees: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.byClassification.set(
      inc.classification,
      (a.byClassification.get(inc.classification) ?? 0) + 1,
    );
    a.daysAway += inc.daysAway ?? 0;
    a.daysRestricted += inc.daysRestricted ?? 0;
    if (inc.jobId) a.jobs.add(inc.jobId);
    const empKey = inc.employeeId ?? `name:${inc.employeeName.toLowerCase()}`;
    a.employees.add(empKey);

    customers.add(cKey);
    months.add(month);
    totalIncidents += 1;
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
  }

  const rows: CustomerIncidentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<IncidentClassification, number>> = {};
      for (const [k, v] of a.byClassification) byClassification[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        total: a.total,
        byClassification,
        totalDaysAway: a.daysAway,
        totalDaysRestricted: a.daysRestricted,
        distinctJobs: a.jobs.size,
        distinctEmployees: a.employees.size,
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
      totalIncidents,
      totalDaysAway,
      totalDaysRestricted,
      unattributed,
    },
    rows,
  };
}
