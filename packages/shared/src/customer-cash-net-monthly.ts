// Per (customer, month) cash net (AR receipts - AP payments).
//
// Plain English: combine AR payments and AP payments per
// agency client, bucket by yyyy-mm of receivedOn / paidOn, and
// compute net cash. Tells YGE which agencies are net-positive
// vs net-negative each month — the customer-axis cousin to
// monthly-cash-net (portfolio) and job-cash-net-monthly
// (per job).
//
// AP payments join via apInvoiceId → ApInvoice.jobId →
// Job.ownerAgency. AR payments join via jobId → Job.ownerAgency.
// Voided AP payments are skipped.
//
// Per row: customerName, month, receiptsCents, paymentsCents,
// netCents, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from monthly-cash-net (portfolio per month),
// job-cash-net-monthly (per job per month), customer-revenue-
// by-job (AR side, no time + AP).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface CustomerCashNetMonthlyRow {
  customerName: string;
  month: string;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  distinctJobs: number;
}

export interface CustomerCashNetMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  voidedSkipped: number;
  unattributed: number;
}

export interface CustomerCashNetMonthlyInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoices: ApInvoice[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to receivedOn / paidOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerCashNetMonthly(
  inputs: CustomerCashNetMonthlyInputs,
): {
  rollup: CustomerCashNetMonthlyRollup;
  rows: CustomerCashNetMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }
  const invoiceJob = new Map<string, string | undefined>();
  for (const inv of inputs.apInvoices) {
    invoiceJob.set(inv.id, inv.jobId);
  }

  type Acc = {
    customerName: string;
    month: string;
    receiptsCents: number;
    paymentsCents: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalReceipts = 0;
  let totalPayments = 0;
  let voidedSkipped = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function bump(
    customerName: string,
    month: string,
    field: 'receiptsCents' | 'paymentsCents',
    cents: number,
    jobId?: string,
  ): void {
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
        month,
        receiptsCents: 0,
        paymentsCents: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a[field] += cents;
    if (jobId) a.jobs.add(jobId);
    customers.add(cKey);
    months.add(month);
  }

  for (const ar of inputs.arPayments) {
    const month = ar.receivedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const customerName = ar.jobId ? jobCustomer.get(ar.jobId) : undefined;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    bump(customerName, month, 'receiptsCents', ar.amountCents, ar.jobId);
    totalReceipts += ar.amountCents;
  }

  for (const ap of inputs.apPayments) {
    const month = ap.paidOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (ap.voided) {
      voidedSkipped += 1;
      continue;
    }
    const jobId = invoiceJob.get(ap.apInvoiceId);
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const customerName = jobCustomer.get(jobId);
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    bump(customerName, month, 'paymentsCents', ap.amountCents, jobId);
    totalPayments += ap.amountCents;
  }

  const rows: CustomerCashNetMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      receiptsCents: a.receiptsCents,
      paymentsCents: a.paymentsCents,
      netCents: a.receiptsCents - a.paymentsCents,
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
      receiptsCents: totalReceipts,
      paymentsCents: totalPayments,
      netCents: totalReceipts - totalPayments,
      voidedSkipped,
      unattributed,
    },
    rows,
  };
}
