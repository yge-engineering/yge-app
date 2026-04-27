// Cost-code library extractor.
//
// Plain English: every time the bookkeeper codes an AP invoice line
// or a foreman tags a time-card entry, they pick a cost code. Over a
// year that produces a long tail of unique codes — many duplicates
// from typos ("01-100" vs "01-1000"), many close-but-not-equal codes
// that should probably be the same. Without a master list, the
// estimator + bookkeeper end up inventing new codes every month.
//
// This module walks the existing data and produces a master library:
// every distinct costCode that's been used, with usage frequency,
// dollar volume, and last-used date so the team can clean up the
// long tail and standardize on a smaller set going forward.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { TimeCard } from './time-card';

export interface CostCodeRow {
  /** The costCode string as it appears in records. */
  costCode: string;
  /** Total times this code appears across AP line items + time-card
   *  entries (sum of usageByApLines + usageByTimeEntries). */
  usageCount: number;
  /** Number of AP invoice line items with this code. */
  usageByApLines: number;
  /** Number of time-card entries with this code. */
  usageByTimeEntries: number;
  /** Sum of AP lineTotalCents for this code. Time-card entries don't
   *  carry a dollar amount at extraction time (labor cost depends on
   *  the employee's burdened rate), so they don't contribute here. */
  apDollarVolumeCents: number;
  /** Number of distinct jobIds this code touches. */
  distinctJobs: number;
  /** Most recent yyyy-mm-dd this code was used. Pulled from the
   *  AP invoice date and time-entry date. */
  lastUsedOn: string;
}

export interface CostCodeLibraryRollup {
  totalCodes: number;
  /** Sum of apDollarVolumeCents across all rows. */
  totalApDollarVolumeCents: number;
  /** Codes used exactly once — likely typos or one-offs to consolidate. */
  oneOffCount: number;
}

export interface CostCodeLibraryInputs {
  apInvoices: ApInvoice[];
  timeCards: TimeCard[];
  /** When true, codes that look like obvious typos (case-only
   *  differences, leading/trailing whitespace) are merged on the
   *  trimmed, lowercased canonical form. Display uses the most-
   *  frequent variant. Default: true. */
  mergeWhitespaceCase?: boolean;
}

interface Bucket {
  display: string;
  variantCounts: Map<string, number>;
  apLines: number;
  timeEntries: number;
  apDollarsCents: number;
  jobs: Set<string>;
  lastUsedOn: string;
}

export function buildCostCodeLibrary(inputs: CostCodeLibraryInputs): {
  rows: CostCodeRow[];
  rollup: CostCodeLibraryRollup;
} {
  const merge = inputs.mergeWhitespaceCase !== false;
  const buckets = new Map<string, Bucket>();

  function recordVariant(
    bucket: Bucket,
    raw: string,
    apLine: boolean,
    apDollarsCents: number,
    timeEntry: boolean,
    jobId: string | undefined,
    usedOn: string,
  ): void {
    bucket.variantCounts.set(raw, (bucket.variantCounts.get(raw) ?? 0) + 1);
    if (apLine) bucket.apLines += 1;
    if (timeEntry) bucket.timeEntries += 1;
    bucket.apDollarsCents += apDollarsCents;
    if (jobId) bucket.jobs.add(jobId);
    if (/^\d{4}-\d{2}-\d{2}$/.test(usedOn) && usedOn > bucket.lastUsedOn) {
      bucket.lastUsedOn = usedOn;
    }
  }

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    for (const line of inv.lineItems ?? []) {
      const raw = line.costCode?.trim();
      if (!raw) continue;
      const key = merge ? raw.toLowerCase() : raw;
      const bucket =
        buckets.get(key) ??
        ({
          display: raw,
          variantCounts: new Map<string, number>(),
          apLines: 0,
          timeEntries: 0,
          apDollarsCents: 0,
          jobs: new Set<string>(),
          lastUsedOn: '',
        } as Bucket);
      recordVariant(
        bucket,
        raw,
        true,
        line.lineTotalCents ?? 0,
        false,
        line.jobId ?? inv.jobId,
        inv.invoiceDate,
      );
      buckets.set(key, bucket);
    }
  }

  for (const card of inputs.timeCards) {
    for (const e of card.entries ?? []) {
      const raw = e.costCode?.trim();
      if (!raw) continue;
      const key = merge ? raw.toLowerCase() : raw;
      const bucket =
        buckets.get(key) ??
        ({
          display: raw,
          variantCounts: new Map<string, number>(),
          apLines: 0,
          timeEntries: 0,
          apDollarsCents: 0,
          jobs: new Set<string>(),
          lastUsedOn: '',
        } as Bucket);
      recordVariant(bucket, raw, false, 0, true, e.jobId, e.date);
      buckets.set(key, bucket);
    }
  }

  // Resolve display name: most-frequent variant wins, ties broken by
  // first-seen (which is what we already have in `display`).
  const rows: CostCodeRow[] = [];
  for (const [, b] of buckets) {
    let bestVariant = b.display;
    let bestCount = b.variantCounts.get(b.display) ?? 0;
    for (const [variant, count] of b.variantCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestVariant = variant;
      }
    }
    rows.push({
      costCode: bestVariant,
      usageCount: b.apLines + b.timeEntries,
      usageByApLines: b.apLines,
      usageByTimeEntries: b.timeEntries,
      apDollarVolumeCents: b.apDollarsCents,
      distinctJobs: b.jobs.size,
      lastUsedOn: b.lastUsedOn,
    });
  }

  // Sort: most-used first, then largest dollar volume, then code asc.
  rows.sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    if (b.apDollarVolumeCents !== a.apDollarVolumeCents) {
      return b.apDollarVolumeCents - a.apDollarVolumeCents;
    }
    return a.costCode.localeCompare(b.costCode);
  });

  let totalApDollarVolumeCents = 0;
  let oneOffCount = 0;
  for (const r of rows) {
    totalApDollarVolumeCents += r.apDollarVolumeCents;
    if (r.usageCount === 1) oneOffCount += 1;
  }

  return {
    rows,
    rollup: {
      totalCodes: rows.length,
      totalApDollarVolumeCents,
      oneOffCount,
    },
  };
}
