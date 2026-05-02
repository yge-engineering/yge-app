// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for expense reimbursements.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ExpenseSchema,
  newExpenseId,
  type Expense,
  type ExpenseCreate,
  type ExpensePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.EXPENSES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'expenses');
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Expense[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ExpenseSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is Expense => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Expense[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createExpense(
  input: ExpenseCreate,
  ctx?: AuditContext,
): Promise<Expense> {
  await ensureDir();
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
  await fs.writeFile(rowPath(id), JSON.stringify(e, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(e);
  await writeIndex(index);
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
  let all = await readIndex();
  if (filter?.employeeId) all = all.filter((e) => e.employeeId === filter.employeeId);
  if (filter?.category) all = all.filter((e) => e.category === filter.category);
  if (filter?.jobId) all = all.filter((e) => e.jobId === filter.jobId);
  if (filter?.reimbursed != null) all = all.filter((e) => e.reimbursed === filter.reimbursed);
  all.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
  return all;
}

export async function getExpense(id: string): Promise<Expense | null> {
  if (!/^exp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ExpenseSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
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
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((e) => e.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
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
