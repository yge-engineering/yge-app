// Per (customer, job) AR revenue rollup.
//
// Plain English: bucket AR invoices by (customerName, jobId)
// and sum what we've billed plus when. "Caltrans D2 has been
// billed $1.2M total — $650k on Sulphur Springs, $400k on
// Allbaugh, $150k on the smaller jobs." That cut.
//
// Per row: customerName, jobId, totalCents, invoiceCount,
// firstInvoiceDate, lastInvoiceDate.
//
// Sort: customerName asc, totalCents desc within customer.
//
// Different from customer-revenue-by-month (per-month, no job
// axis), customer-revenue-by-source (per-source, no job axis),
// customer-job-pipeline (status counts, not dollars),
// vendor-spend-by-job (AP side).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface CustomerRevenueByJobRow {
  customerName: string;
  jobId: string;
  totalCents: number;
  invoiceCount: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
}

export interface CustomerRevenueByJobRollup {
  customersConsidered: number;
  jobsConsidered: number;
  totalInvoices: number;
  totalCents: number;
}

export interface CustomerRevenueByJobInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

function normCust(s: string): string {
  return s.toLowerCase().trim();
}

export function buildCustomerRevenueByJob(
  inputs: CustomerRevenueByJobInputs,
): {
  rollup: CustomerRevenueByJobRollup;
  rows: CustomerRevenueByJobRow[];
} {
  type Acc = {
    customerName: string;
    jobId: string;
    totalCents: number;
    invoiceCount: number;
    firstInvoiceDate: string | null;
    lastInvoiceDate: string | null;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const jobs = new Set<string>();

  let totalInvoices = 0;
  let totalCents = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const inv of inputs.arInvoices) {
    if (fromD && inv.invoiceDate < fromD) continue;
    if (toD && inv.invoiceDate > toD) continue;

    const cKey = normCust(inv.customerName);
    const key = `${cKey}__${inv.jobId}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName: inv.customerName,
        jobId: inv.jobId,
        totalCents: 0,
        invoiceCount: 0,
        firstInvoiceDate: null,
        lastInvoiceDate: null,
      };
      accs.set(key, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.invoiceCount += 1;
    if (a.firstInvoiceDate === null || inv.invoiceDate < a.firstInvoiceDate) {
      a.firstInvoiceDate = inv.invoiceDate;
    }
    if (a.lastInvoiceDate === null || inv.invoiceDate > a.lastInvoiceDate) {
      a.lastInvoiceDate = inv.invoiceDate;
    }

    customers.add(cKey);
    jobs.add(inv.jobId);
    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
  }

  const rows = [...accs.values()].sort((x, y) => {
    const cn = x.customerName.localeCompare(y.customerName);
    if (cn !== 0) return cn;
    return y.totalCents - x.totalCents;
  });

  return {
    rollup: {
      customersConsidered: customers.size,
      jobsConsidered: jobs.size,
      totalInvoices,
      totalCents,
    },
    rows,
  };
}
