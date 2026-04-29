// Per (job, ArInvoiceSource) billing rollup.
//
// Plain English: per job, break out billing by source — MANUAL
// vs PROGRESS vs DAILY_REPORTS vs LUMP_SUM. Useful for
// validating that pay-app jobs actually bill via PROGRESS.
//
// Per row: jobId, source, totalCents, invoiceCount,
// firstInvoiceDate, lastInvoiceDate.
//
// Sort: jobId asc, totalCents desc within job.
//
// Different from ar-invoice-source-mix (portfolio per source),
// customer-billing-by-source-monthly (customer × source ×
// month), customer-revenue-by-source (per customer per source).
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceSource } from './ar-invoice';

export interface JobBillingBySourceRow {
  jobId: string;
  source: ArInvoiceSource;
  totalCents: number;
  invoiceCount: number;
  firstInvoiceDate: string;
  lastInvoiceDate: string;
}

export interface JobBillingBySourceRollup {
  jobsConsidered: number;
  sourcesConsidered: number;
  totalCents: number;
}

export interface JobBillingBySourceInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobBillingBySource(
  inputs: JobBillingBySourceInputs,
): {
  rollup: JobBillingBySourceRollup;
  rows: JobBillingBySourceRow[];
} {
  type Acc = {
    jobId: string;
    source: ArInvoiceSource;
    cents: number;
    invoices: number;
    firstDate: string;
    lastDate: string;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const sourceSet = new Set<ArInvoiceSource>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    const key = `${inv.jobId}|${inv.source}`;
    const acc = accs.get(key) ?? {
      jobId: inv.jobId,
      source: inv.source,
      cents: 0,
      invoices: 0,
      firstDate: inv.invoiceDate,
      lastDate: inv.invoiceDate,
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    if (inv.invoiceDate < acc.firstDate) acc.firstDate = inv.invoiceDate;
    if (inv.invoiceDate > acc.lastDate) acc.lastDate = inv.invoiceDate;
    accs.set(key, acc);
    jobSet.add(inv.jobId);
    sourceSet.add(inv.source);
    totalCents += inv.totalCents;
  }

  const rows: JobBillingBySourceRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      source: acc.source,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      firstInvoiceDate: acc.firstDate,
      lastInvoiceDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.totalCents - a.totalCents;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      sourcesConsidered: sourceSet.size,
      totalCents,
    },
    rows,
  };
}
