// Per-customer job pipeline by status.
//
// Plain English: a heavy-civil customer like Caltrans District 2
// might have 20 jobs in our system at once — 6 in PURSUING, 4 in
// BID_SUBMITTED waiting on bid-tab results, 2 AWARDED actively
// running, 8 LOST or NO_BID. This rolls Job records up by their
// owner agency (customer) so we can see at a glance who has the
// most active pursuits and who's awarding work.
//
// Per row: customerName (canonical), totals per status:
// prospect, pursuing, bidSubmitted, awarded, lost, noBid,
// archived. total = sum.
//
// Sort by awarded desc, ties by total desc.
//
// Different from customer-concentration ($ revenue),
// customer-month-matrix (per month), customer-lifetime (lifetime
// $), and bid-pipeline (active list, not customer-grouped).
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface CustomerJobPipelineRow {
  customerName: string;
  total: number;
  prospect: number;
  pursuing: number;
  bidSubmitted: number;
  awarded: number;
  lost: number;
  noBid: number;
  archived: number;
}

export interface CustomerJobPipelineRollup {
  customersConsidered: number;
  total: number;
  awarded: number;
  unattributed: number;
}

export interface CustomerJobPipelineInputs {
  jobs: Job[];
}

export function buildCustomerJobPipeline(
  inputs: CustomerJobPipelineInputs,
): {
  rollup: CustomerJobPipelineRollup;
  rows: CustomerJobPipelineRow[];
} {
  type Acc = {
    display: string;
    counts: Record<JobStatus, number>;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;
  let totalAwarded = 0;

  for (const j of inputs.jobs) {
    const display = (j.ownerAgency ?? '').trim();
    if (j.status === 'AWARDED') totalAwarded += 1;
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = canonicalize(display);
    const acc = accs.get(key) ?? {
      display,
      counts: {
        PROSPECT: 0,
        PURSUING: 0,
        BID_SUBMITTED: 0,
        AWARDED: 0,
        LOST: 0,
        NO_BID: 0,
        ARCHIVED: 0,
      },
    };
    acc.counts[j.status] += 1;
    accs.set(key, acc);
  }

  const rows: CustomerJobPipelineRow[] = [];
  for (const acc of accs.values()) {
    let total = 0;
    for (const v of Object.values(acc.counts)) total += v;
    rows.push({
      customerName: acc.display,
      total,
      prospect: acc.counts.PROSPECT,
      pursuing: acc.counts.PURSUING,
      bidSubmitted: acc.counts.BID_SUBMITTED,
      awarded: acc.counts.AWARDED,
      lost: acc.counts.LOST,
      noBid: acc.counts.NO_BID,
      archived: acc.counts.ARCHIVED,
    });
  }

  rows.sort((a, b) => {
    if (b.awarded !== a.awarded) return b.awarded - a.awarded;
    return b.total - a.total;
  });

  return {
    rollup: {
      customersConsidered: rows.length,
      total: inputs.jobs.length,
      awarded: totalAwarded,
      unattributed,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
