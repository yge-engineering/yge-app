// Postgres-backed store for expenses.

import { prisma } from '@yge/db';
import {
  ExpenseSchema,
  newExpenseId,
  type Expense,
  type ExpenseCreate,
  type ExpensePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2exp(row: { data: unknown }): Expense {
  return ExpenseSchema.parse(row.data);
}

export async function createExpense(
  input: ExpenseCreate,
  ctx?: AuditContext,
): Promise<Expense> {
  const now = new Date().toISOString();
  const id = newExpenseId();
  const e: Expense = {
    id,
    createdAt: now,
    updatedAt: now,
    category: input.category ?? 'OTHER',
    paidWithCompanyCard: input.paidWithCompanyCard ?? false,
    reimbursed: input.reimbursed ?? false,
    ...input,
  };
  ExpenseSchema.parse(e);
  await prisma.expense.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      data: e as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Expense',
    entityId: id,
    after: e,
    ctx,
  });
  return e;
}

export async function listExpenses(filter?: {
  employeeId?: string;
  category?: string;
  jobId?: string;
  reimbursed?: boolean;
}): Promise<Expense[]> {
  const rows = await prisma.expense.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2exp);
  if (filter?.employeeId) all = all.filter((e) => e.employeeId === filter.employeeId);
  if (filter?.category) all = all.filter((e) => e.category === filter.category);
  if (filter?.jobId) all = all.filter((e) => e.jobId === filter.jobId);
  if (filter?.reimbursed !== undefined)
    all = all.filter((e) => e.reimbursed === filter.reimbursed);
  return all;
}

export async function getExpense(id: string): Promise<Expense | null> {
  if (!/^exp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.expense.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2exp(row) : null;
}

export async function updateExpense(
  id: string,
  patch: ExpensePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' = 'update',
): Promise<Expense | null> {
  const existing = await getExpense(id);
  if (!existing) return null;
  const updated: Expense = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ExpenseSchema.parse(updated);
  await prisma.expense.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Expense',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
