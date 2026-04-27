// Expense reimbursement routes.

import { Router } from 'express';
import {
  ExpenseCreateSchema,
  ExpensePatchSchema,
  csvDollars,
  defaultGlAccountForCategory,
  expenseCategoryLabel,
  expenseReimbursableCents,
  type Expense,
} from '@yge/shared';
import {
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '../lib/expenses-store';
import { maybeCsv } from '../lib/csv-response';

export const expensesRouter = Router();

const EXPENSE_CSV_COLUMNS = [
  { header: 'Date', get: (e: Expense) => e.receiptDate },
  { header: 'Employee', get: (e: Expense) => e.employeeName },
  { header: 'Vendor', get: (e: Expense) => e.vendor },
  { header: 'Description', get: (e: Expense) => e.description },
  { header: 'Category', get: (e: Expense) => expenseCategoryLabel(e.category) },
  { header: 'Job', get: (e: Expense) => e.jobId ?? '' },
  {
    header: 'GL',
    get: (e: Expense) => e.glAccountNumber ?? defaultGlAccountForCategory(e.category),
  },
  { header: 'Amount', get: (e: Expense) => csvDollars(e.amountCents) },
  { header: 'Co. card?', get: (e: Expense) => (e.paidWithCompanyCard ? 'Yes' : 'No') },
  { header: 'Reimbursable', get: (e: Expense) => csvDollars(expenseReimbursableCents(e)) },
  { header: 'Reimbursed', get: (e: Expense) => (e.reimbursed ? 'Yes' : 'No') },
] as const;

expensesRouter.get('/', async (req, res, next) => {
  try {
    const expenses = await listExpenses({
      employeeId: typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      reimbursed:
        req.query.reimbursed === 'true'
          ? true
          : req.query.reimbursed === 'false'
            ? false
            : undefined,
    });
    if (maybeCsv(req, res, expenses, EXPENSE_CSV_COLUMNS, 'expenses')) return;
    return res.json({ expenses });
  } catch (err) {
    next(err);
  }
});

expensesRouter.get('/:id', async (req, res, next) => {
  try {
    const e = await getExpense(req.params.id);
    if (!e) return res.status(404).json({ error: 'Expense not found' });
    return res.json({ expense: e });
  } catch (err) {
    next(err);
  }
});

expensesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ExpenseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const e = await createExpense(parsed.data);
    return res.status(201).json({ expense: e });
  } catch (err) {
    next(err);
  }
});

expensesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ExpensePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateExpense(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    return res.json({ expense: updated });
  } catch (err) {
    next(err);
  }
});
