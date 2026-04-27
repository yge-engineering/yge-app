// Per-employee expense reimbursement.
//
// Captures a single receipt (meal, lodging, parking, fuel, parts run,
// tool purchase, etc.) the employee paid out of pocket and is owed
// back. Aggregates with mileage entries to build a per-employee
// reimbursement run.
//
// Phase 1 stores the receipt + a `reimbursed` flag. Phase 2 will:
//   - Bundle receipts + mileage into a single Reimbursement Run
//   - Auto-post a JE: Dr <category expense> / Cr Accrued Payroll
//   - Pay through the next payroll cycle

import { z } from 'zod';

export const ExpenseCategorySchema = z.enum([
  'MEAL',           // crew meal on travel
  'PER_DIEM',       // daily allowance
  'LODGING',        // hotel
  'FUEL',           // gas / diesel for personal vehicle when on a job
  'PARKING',
  'TOLLS',
  'MATERIAL',       // employee picked up materials
  'TOOL_PURCHASE',  // small tool bought on the job
  'PERMIT_FEE',
  'TRAINING_FEE',
  'AGENCY_FEE',     // CSLB renewal, DIR fees, etc.
  'OFFICE_SUPPLIES',
  'OTHER',
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const ExpenseSchema = z.object({
  /** Stable id `exp-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Employee being reimbursed. */
  employeeId: z.string().min(1).max(120),
  employeeName: z.string().min(1).max(120),

  /** Date on the receipt (yyyy-mm-dd). */
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Vendor / merchant name. */
  vendor: z.string().min(1).max(200),
  /** What was bought / for. */
  description: z.string().min(1).max(500),
  /** Total cents (gross). */
  amountCents: z.number().int().positive(),

  category: ExpenseCategorySchema.default('OTHER'),
  /** Optional job tag for cost-coding. */
  jobId: z.string().max(120).optional(),
  /** Optional GL account override. Defaults can be inferred from
   *  category at posting time. */
  glAccountNumber: z.string().max(10).optional(),

  /** Optional receipt image / file reference (filename, drive URL,
   *  S3 key). */
  receiptRef: z.string().max(800).optional(),

  /** Optional: was this paid on a company card vs out of pocket? */
  paidWithCompanyCard: z.boolean().default(false),

  reimbursed: z.boolean().default(false),
  reimbursedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  notes: z.string().max(10_000).optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const ExpenseCreateSchema = ExpenseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: ExpenseCategorySchema.optional(),
  paidWithCompanyCard: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
});
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;

export const ExpensePatchSchema = ExpenseCreateSchema.partial();
export type ExpensePatch = z.infer<typeof ExpensePatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function expenseCategoryLabel(c: ExpenseCategory): string {
  switch (c) {
    case 'MEAL': return 'Meal';
    case 'PER_DIEM': return 'Per diem';
    case 'LODGING': return 'Lodging';
    case 'FUEL': return 'Fuel';
    case 'PARKING': return 'Parking';
    case 'TOLLS': return 'Tolls';
    case 'MATERIAL': return 'Material';
    case 'TOOL_PURCHASE': return 'Tool purchase';
    case 'PERMIT_FEE': return 'Permit fee';
    case 'TRAINING_FEE': return 'Training fee';
    case 'AGENCY_FEE': return 'Agency fee';
    case 'OFFICE_SUPPLIES': return 'Office supplies';
    case 'OTHER': return 'Other';
  }
}

/** Default GL account number per category. Brook can override on the
 *  expense record. Numbers match the COA seed. */
export function defaultGlAccountForCategory(c: ExpenseCategory): string {
  switch (c) {
    case 'MEAL':
    case 'PER_DIEM':
    case 'LODGING':
      return '58000'; // Other direct job cost
    case 'FUEL':
      return '53200';
    case 'PARKING':
    case 'TOLLS':
      return '58000';
    case 'MATERIAL':
      return '52000';
    case 'TOOL_PURCHASE':
      return '53300';
    case 'PERMIT_FEE':
      return '55000';
    case 'TRAINING_FEE':
      return '69000';
    case 'AGENCY_FEE':
      return '67000';
    case 'OFFICE_SUPPLIES':
      return '69000';
    case 'OTHER':
      return '69000';
  }
}

/** Reimbursable cents — only out-of-pocket (not company-card) entries
 *  flow through reimbursement. Company-card entries become AP invoices
 *  on the card vendor's monthly statement instead. */
export function expenseReimbursableCents(e: Pick<Expense, 'amountCents' | 'paidWithCompanyCard'>): number {
  return e.paidWithCompanyCard ? 0 : e.amountCents;
}

export interface ExpenseRollup {
  total: number;
  totalCents: number;
  /** Out-of-pocket subset (not company-card). */
  reimbursableCents: number;
  /** Already paid back. */
  reimbursedCents: number;
  /** Outstanding owed to employees. */
  outstandingCents: number;
  /** Counts by category. */
  byCategory: Array<{ category: ExpenseCategory; count: number; cents: number }>;
}

export function computeExpenseRollup(expenses: Expense[]): ExpenseRollup {
  let totalCents = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  const catMap = new Map<ExpenseCategory, { count: number; cents: number }>();
  for (const e of expenses) {
    totalCents += e.amountCents;
    const reimb = expenseReimbursableCents(e);
    reimbursableCents += reimb;
    if (e.reimbursed) reimbursedCents += reimb;
    const cur = catMap.get(e.category) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += e.amountCents;
    catMap.set(e.category, cur);
  }
  return {
    total: expenses.length,
    totalCents,
    reimbursableCents,
    reimbursedCents,
    outstandingCents: Math.max(0, reimbursableCents - reimbursedCents),
    byCategory: Array.from(catMap.entries())
      .map(([category, v]) => ({ category, count: v.count, cents: v.cents }))
      .sort((a, b) => b.cents - a.cents),
  };
}

export function newExpenseId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `exp-${hex.padStart(8, '0')}`;
}
