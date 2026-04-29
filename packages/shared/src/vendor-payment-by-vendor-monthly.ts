// Per (vendor, month) AP payment rollup.
//
// Plain English: bucket non-voided AP payments by canonical
// vendor name and yyyy-mm of paidOn. Tracks the cash-out cadence
// per vendor over time — distinct from vendor-spend-monthly
// which sums invoice dates (incurred). When YGE wants to know
// "what did I actually pay Granite each month", this is it.
//
// Per row: vendorName, month, totalPayments, totalAmountCents,
// distinctInvoices, distinctJobs (via apInvoice → jobId join),
// firstPaidOn, lastPaidOn.
//
// Sort: vendorName asc, month asc.
//
// Different from vendor-spend-monthly (invoice-date based),
// vendor-payment-method-monthly (portfolio per-month per-
// method), ap-payment-monthly (single line per month),
// ap-payment-by-job (job axis, no time).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';

export interface VendorPaymentByVendorMonthlyRow {
  vendorName: string;
  month: string;
  totalPayments: number;
  totalAmountCents: number;
  distinctInvoices: number;
  distinctJobs: number;
  firstPaidOn: string | null;
  lastPaidOn: string | null;
}

export interface VendorPaymentByVendorMonthlyRollup {
  vendorsConsidered: number;
  monthsConsidered: number;
  totalPayments: number;
  totalAmountCents: number;
  voidedSkipped: number;
}

export interface VendorPaymentByVendorMonthlyInputs {
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
  /** Optional yyyy-mm bounds inclusive applied to paidOn. */
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

export function buildVendorPaymentByVendorMonthly(
  inputs: VendorPaymentByVendorMonthlyInputs,
): {
  rollup: VendorPaymentByVendorMonthlyRollup;
  rows: VendorPaymentByVendorMonthlyRow[];
} {
  // Index AP invoices by id for quick jobId lookup.
  const invoiceJob = new Map<string, string | undefined>();
  for (const inv of inputs.apInvoices) {
    invoiceJob.set(inv.id, inv.jobId);
  }

  type Acc = {
    vendorName: string;
    month: string;
    totalPayments: number;
    totalAmountCents: number;
    invoices: Set<string>;
    jobs: Set<string>;
    firstPaidOn: string | null;
    lastPaidOn: string | null;
  };
  const accs = new Map<string, Acc>();
  const vendors = new Set<string>();
  const months = new Set<string>();

  let voidedSkipped = 0;
  let totalPayments = 0;
  let totalAmount = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const p of inputs.apPayments) {
    const month = p.paidOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }

    const vKey = normVendor(p.vendorName);
    const key = `${vKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        vendorName: p.vendorName,
        month,
        totalPayments: 0,
        totalAmountCents: 0,
        invoices: new Set(),
        jobs: new Set(),
        firstPaidOn: null,
        lastPaidOn: null,
      };
      accs.set(key, a);
    }
    a.totalPayments += 1;
    a.totalAmountCents += p.amountCents;
    a.invoices.add(p.apInvoiceId);
    const jobId = invoiceJob.get(p.apInvoiceId);
    if (jobId) a.jobs.add(jobId);
    if (a.firstPaidOn === null || p.paidOn < a.firstPaidOn) a.firstPaidOn = p.paidOn;
    if (a.lastPaidOn === null || p.paidOn > a.lastPaidOn) a.lastPaidOn = p.paidOn;

    vendors.add(vKey);
    months.add(month);
    totalPayments += 1;
    totalAmount += p.amountCents;
  }

  const rows: VendorPaymentByVendorMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      vendorName: a.vendorName,
      month: a.month,
      totalPayments: a.totalPayments,
      totalAmountCents: a.totalAmountCents,
      distinctInvoices: a.invoices.size,
      distinctJobs: a.jobs.size,
      firstPaidOn: a.firstPaidOn,
      lastPaidOn: a.lastPaidOn,
    }))
    .sort((x, y) => {
      const v = x.vendorName.localeCompare(y.vendorName);
      if (v !== 0) return v;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      vendorsConsidered: vendors.size,
      monthsConsidered: months.size,
      totalPayments,
      totalAmountCents: totalAmount,
      voidedSkipped,
    },
    rows,
  };
}
