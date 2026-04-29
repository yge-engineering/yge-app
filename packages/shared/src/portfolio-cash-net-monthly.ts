// Portfolio cash net by month with cumulative running balance.
//
// Plain English: company-wide cash in (AR receipts) minus
// cash out (non-voided AP payments) by yyyy-mm. Adds running
// cumulative receipts, payments, and net so the owner can
// scan the rolling cash trajectory at a glance.
//
// Per row: month, receiptsCents, paymentsCents, netCents,
// cumulativeReceiptsCents, cumulativePaymentsCents,
// cumulativeNetCents, distinctReceiptCustomers (via Job →
// ownerAgency), distinctPaymentVendors.
//
// Sort: month asc.
//
// Different from monthly-cash-net (no cumulative + no
// distinct customer/vendor counts), customer-cash-net-monthly
// (per customer), job-cash-net-monthly (per job).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

export interface PortfolioCashNetMonthlyRow {
  month: string;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  cumulativeReceiptsCents: number;
  cumulativePaymentsCents: number;
  cumulativeNetCents: number;
  distinctReceiptCustomers: number;
  distinctPaymentVendors: number;
}

export interface PortfolioCashNetMonthlyRollup {
  monthsConsidered: number;
  receiptsCents: number;
  paymentsCents: number;
  netCents: number;
  voidedSkipped: number;
}

export interface PortfolioCashNetMonthlyInputs {
  arPayments: ArPayment[];
  apPayments: ApPayment[];
  apInvoices: ApInvoice[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to receivedOn / paidOn. */
  fromMonth?: string;
  toMonth?: string;
}

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPortfolioCashNetMonthly(
  inputs: PortfolioCashNetMonthlyInputs,
): {
  rollup: PortfolioCashNetMonthlyRollup;
  rows: PortfolioCashNetMonthlyRow[];
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
    month: string;
    receiptsCents: number;
    paymentsCents: number;
    customers: Set<string>;
    vendors: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalReceipts = 0;
  let totalPayments = 0;
  let voidedSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(month: string): Acc {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        receiptsCents: 0,
        paymentsCents: 0,
        customers: new Set(),
        vendors: new Set(),
      };
      accs.set(month, a);
    }
    return a;
  }

  for (const ar of inputs.arPayments) {
    const month = ar.receivedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const a = get(month);
    a.receiptsCents += ar.amountCents;
    if (ar.jobId) {
      const customer = jobCustomer.get(ar.jobId);
      if (customer) a.customers.add(customer.toLowerCase().trim());
    }
    totalReceipts += ar.amountCents;
  }

  for (const p of inputs.apPayments) {
    const month = p.paidOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    const a = get(month);
    a.paymentsCents += p.amountCents;
    a.vendors.add(normVendor(p.vendorName));
    totalPayments += p.amountCents;
  }

  const sorted = [...accs.values()].sort((x, y) => x.month.localeCompare(y.month));
  let cumReceipts = 0;
  let cumPayments = 0;

  const rows: PortfolioCashNetMonthlyRow[] = sorted.map((a) => {
    cumReceipts += a.receiptsCents;
    cumPayments += a.paymentsCents;
    return {
      month: a.month,
      receiptsCents: a.receiptsCents,
      paymentsCents: a.paymentsCents,
      netCents: a.receiptsCents - a.paymentsCents,
      cumulativeReceiptsCents: cumReceipts,
      cumulativePaymentsCents: cumPayments,
      cumulativeNetCents: cumReceipts - cumPayments,
      distinctReceiptCustomers: a.customers.size,
      distinctPaymentVendors: a.vendors.size,
    };
  });

  return {
    rollup: {
      monthsConsidered: rows.length,
      receiptsCents: totalReceipts,
      paymentsCents: totalPayments,
      netCents: totalReceipts - totalPayments,
      voidedSkipped,
    },
    rows,
  };
}
