// Per (customer, month) toolbox-talk activity.
//
// Plain English: join toolbox talks to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// heldOn). Counts talks, distinct topics, distinct leaders,
// total + signed attendees. Surfaces "how is safety
// documentation tracking on each agency's job sites" — handy
// when a Cal/OSHA inspector arrives at a Caltrans site.
//
// Per row: customerName, month, talks, distinctTopics,
// distinctLeaders, totalAttendees, signedAttendees,
// distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from job-toolbox-monthly (per job axis),
// employee-toolbox-monthly (per employee), toolbox-by-leader
// (per leader), toolbox-compliance (overall).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { ToolboxTalk } from './toolbox-talk';

export interface CustomerToolboxMonthlyRow {
  customerName: string;
  month: string;
  talks: number;
  distinctTopics: number;
  distinctLeaders: number;
  totalAttendees: number;
  signedAttendees: number;
  distinctJobs: number;
}

export interface CustomerToolboxMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalTalks: number;
  unattributed: number;
}

export interface CustomerToolboxMonthlyInputs {
  toolboxTalks: ToolboxTalk[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to heldOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerToolboxMonthly(
  inputs: CustomerToolboxMonthlyInputs,
): {
  rollup: CustomerToolboxMonthlyRollup;
  rows: CustomerToolboxMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    talks: number;
    topics: Set<string>;
    leaders: Set<string>;
    totalAttendees: number;
    signedAttendees: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalTalks = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const t of inputs.toolboxTalks) {
    const month = t.heldOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = t.jobId ? jobCustomer.get(t.jobId) : undefined;
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
        talks: 0,
        topics: new Set(),
        leaders: new Set(),
        totalAttendees: 0,
        signedAttendees: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.talks += 1;
    a.topics.add(t.topic.toLowerCase().trim());
    a.leaders.add(t.leaderName);
    const attendees = t.attendees ?? [];
    a.totalAttendees += attendees.length;
    for (const at of attendees) {
      if (at.signed) a.signedAttendees += 1;
    }
    if (t.jobId) a.jobs.add(t.jobId);

    customers.add(cKey);
    months.add(month);
    totalTalks += 1;
  }

  const rows: CustomerToolboxMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      talks: a.talks,
      distinctTopics: a.topics.size,
      distinctLeaders: a.leaders.size,
      totalAttendees: a.totalAttendees,
      signedAttendees: a.signedAttendees,
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
      totalTalks,
      unattributed,
    },
    rows,
  };
}
