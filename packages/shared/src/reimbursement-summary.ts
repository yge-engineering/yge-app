// Per-employee reimbursement summary.
//
// Pure derivation. Bundles every outstanding mileage entry and every
// outstanding (out-of-pocket, not-yet-reimbursed) expense receipt
// for a given employee into a single roll-up that:
//   - Drives the per-employee detail page
//   - Prints as a single sheet Brook can attach to the next paycheck
//   - Powers "mark all as paid" by exposing the underlying ids
//
// No new persisted records. Phase 2 will fold this into the payroll
// run + auto-post a JE on the "mark paid" action.

import {
  expenseReimbursableCents,
  type Expense,
} from './expense';
import {
  reimbursementCents,
  type MileageEntry,
} from './mileage';

export interface ReimbursementMileageRow {
  id: string;
  tripDate: string;
  vehicleDescription: string;
  businessMiles: number;
  irsRateCentsPerMile: number;
  reimburseCents: number;
  description?: string;
  jobId?: string;
}

export interface ReimbursementExpenseRow {
  id: string;
  receiptDate: string;
  vendor: string;
  description: string;
  category: Expense['category'];
  amountCents: number;
  jobId?: string;
}

export interface EmployeeReimbursementSummary {
  employeeId: string;
  employeeName: string;
  /** Mileage entries owed (personal vehicle, not yet reimbursed). */
  mileageRows: ReimbursementMileageRow[];
  /** Expense receipts owed (out-of-pocket, not yet reimbursed). */
  expenseRows: ReimbursementExpenseRow[];
  totalMileageCents: number;
  totalExpenseCents: number;
  totalCents: number;
  /** Total mileage in business miles. */
  totalMiles: number;
}

/** Build the summary for a single employee. Caller pre-filters by
 *  employeeId; the helper handles the "outstanding" filter. */
export function buildEmployeeReimbursementSummary(args: {
  employeeId: string;
  employeeName: string;
  mileage: MileageEntry[];
  expenses: Expense[];
}): EmployeeReimbursementSummary {
  const { employeeId, employeeName, mileage, expenses } = args;

  const mileageRows: ReimbursementMileageRow[] = [];
  let totalMileageCents = 0;
  let totalMiles = 0;
  for (const m of mileage) {
    if (m.employeeId !== employeeId) continue;
    if (!m.isPersonalVehicle) continue;
    if (m.reimbursed) continue;
    const reimb = reimbursementCents(m);
    if (reimb <= 0) continue;
    mileageRows.push({
      id: m.id,
      tripDate: m.tripDate,
      vehicleDescription: m.vehicleDescription,
      businessMiles: m.businessMiles,
      irsRateCentsPerMile: m.irsRateCentsPerMile ?? 0,
      reimburseCents: reimb,
      description: m.description,
      jobId: m.jobId,
    });
    totalMileageCents += reimb;
    totalMiles += m.businessMiles;
  }
  mileageRows.sort((a, b) => a.tripDate.localeCompare(b.tripDate));

  const expenseRows: ReimbursementExpenseRow[] = [];
  let totalExpenseCents = 0;
  for (const e of expenses) {
    if (e.employeeId !== employeeId) continue;
    if (e.paidWithCompanyCard) continue;
    if (e.reimbursed) continue;
    const reimb = expenseReimbursableCents(e);
    if (reimb <= 0) continue;
    expenseRows.push({
      id: e.id,
      receiptDate: e.receiptDate,
      vendor: e.vendor,
      description: e.description,
      category: e.category,
      amountCents: reimb,
      jobId: e.jobId,
    });
    totalExpenseCents += reimb;
  }
  expenseRows.sort((a, b) => a.receiptDate.localeCompare(b.receiptDate));

  return {
    employeeId,
    employeeName,
    mileageRows,
    expenseRows,
    totalMileageCents,
    totalExpenseCents,
    totalCents: totalMileageCents + totalExpenseCents,
    totalMiles,
  };
}

/** Build summaries for every employee with any outstanding amount.
 *  Sorted by total owed, descending. */
export function buildAllReimbursementSummaries(args: {
  mileage: MileageEntry[];
  expenses: Expense[];
}): EmployeeReimbursementSummary[] {
  const { mileage, expenses } = args;
  // Discover every employee that has at least one outstanding row.
  const namesByEmployee = new Map<string, string>();
  for (const m of mileage) {
    if (m.isPersonalVehicle && !m.reimbursed && reimbursementCents(m) > 0) {
      namesByEmployee.set(m.employeeId, m.employeeName);
    }
  }
  for (const e of expenses) {
    if (!e.paidWithCompanyCard && !e.reimbursed && expenseReimbursableCents(e) > 0) {
      // Don't overwrite a name we already have from mileage if the
      // expense's employeeName drifted.
      if (!namesByEmployee.has(e.employeeId)) {
        namesByEmployee.set(e.employeeId, e.employeeName);
      }
    }
  }

  const summaries: EmployeeReimbursementSummary[] = [];
  for (const [employeeId, employeeName] of namesByEmployee) {
    const summary = buildEmployeeReimbursementSummary({
      employeeId,
      employeeName,
      mileage,
      expenses,
    });
    if (summary.totalCents > 0) summaries.push(summary);
  }
  summaries.sort((a, b) => b.totalCents - a.totalCents);
  return summaries;
}

export interface ReimbursementGrandTotals {
  employees: number;
  mileageCents: number;
  expenseCents: number;
  totalCents: number;
}

export function computeReimbursementGrandTotals(
  summaries: EmployeeReimbursementSummary[],
): ReimbursementGrandTotals {
  let mileageCents = 0;
  let expenseCents = 0;
  for (const s of summaries) {
    mileageCents += s.totalMileageCents;
    expenseCents += s.totalExpenseCents;
  }
  return {
    employees: summaries.length,
    mileageCents,
    expenseCents,
    totalCents: mileageCents + expenseCents,
  };
}
