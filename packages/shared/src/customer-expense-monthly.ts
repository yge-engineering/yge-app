// Per (customer, month) employee expense rollup.
//
// Plain English: join expense receipts to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// receiptDate). Sums cents, breaks down by category, distinct
// employees + jobs. Drives the customer-side reimbursement
// rebill summary.
//
// Per row: customerName, month, count, totalCents, byCategory,
// distinctEmployees, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from expense-by-job-monthly (per job axis),
// expense-by-category-monthly (per category axis), expense-
// by-employee (per employee).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';
import type { Job } from './job';

export interface CustomerExpenseMonthlyRow {
  customerName: string;
  month: string;
  count: number;
  totalCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface CustomerExpenseMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalReceipts: number;
  totalCents: number;
  unattributed: number;
}

export interface CustomerExpenseMonthlyInputs {
  expenses: Expense[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerExpenseMonthly(
  inputs: CustomerExpenseMonthlyInputs,
): {
  rollup: CustomerExpenseMonthlyRollup;
  rows: CustomerExpenseMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    count: number;
    cents: number;
    byCategory: Map<ExpenseCategory, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalReceipts = 0;
  let totalCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = e.jobId ? jobCustomer.get(e.jobId) : undefined;
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
        count: 0,
        cents: 0,
        byCategory: new Map(),
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.count += 1;
    a.cents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    a.byCategory.set(cat, (a.byCategory.get(cat) ?? 0) + 1);
    a.employees.add(e.employeeName);
    if (e.jobId) a.jobs.add(e.jobId);

    customers.add(cKey);
    months.add(month);
    totalReceipts += 1;
    totalCents += e.amountCents;
  }

  const rows: CustomerExpenseMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCategory: Partial<Record<ExpenseCategory, number>> = {};
      for (const [k, v] of a.byCategory) byCategory[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        count: a.count,
        totalCents: a.cents,
        byCategory,
        distinctEmployees: a.employees.size,
        distinctJobs: a.jobs.size,
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
      totalReceipts,
      totalCents,
      unattributed,
    },
    rows,
  };
}
