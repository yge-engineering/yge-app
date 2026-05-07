// Postgres-backed store for the chart of accounts.

import { prisma } from '@yge/db';
import {
  AccountSchema,
  DEFAULT_COA_SEED,
  newAccountId,
  type Account,
  type AccountCreate,
  type AccountPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2acc(row: { data: unknown }): Account | null {
  const r = AccountSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export async function createAccount(
  input: AccountCreate,
  ctx?: AuditContext,
): Promise<Account> {
  const now = new Date().toISOString();
  const id = newAccountId();
  const a: Account = AccountSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    active: input.active ?? true,
    ...input,
  });
  await prisma.chartAccount.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      number: a.number,
      name: a.name,
      data: a as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Account',
    entityId: id,
    after: a,
    ctx,
  });
  return a;
}

export async function listAccounts(filter?: {
  type?: string;
  active?: boolean;
}): Promise<Account[]> {
  const rows = await prisma.chartAccount.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  let all = rows.map(row2acc).filter((a): a is Account => a !== null);
  if (filter?.type) all = all.filter((a) => a.type === filter.type);
  if (filter?.active != null) all = all.filter((a) => a.active === filter.active);
  all.sort((a, b) => a.number.localeCompare(b.number));
  return all;
}

export async function getAccount(id: string): Promise<Account | null> {
  if (!/^acc-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.chartAccount.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2acc(row);
}

export async function updateAccount(
  id: string,
  patch: AccountPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Account | null> {
  const existing = await getAccount(id);
  if (!existing) return null;
  const updated: Account = AccountSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await prisma.chartAccount.update({
    where: { id },
    data: {
      number: updated.number,
      name: updated.name,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Account',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Apply the default COA seed. Idempotent — skips numbers that already
 *  exist in the table. Returns the rows that were added. */
export async function applyDefaultCoaSeed(): Promise<Account[]> {
  const existing = await listAccounts();
  const haveNumbers = new Set(existing.map((a) => a.number));
  const added: Account[] = [];
  for (const seed of DEFAULT_COA_SEED) {
    if (haveNumbers.has(seed.number)) continue;
    const a = await createAccount({
      number: seed.number,
      name: seed.name,
      type: seed.type,
      parentNumber: seed.parentNumber,
      description: seed.description,
      active: true,
    });
    added.push(a);
  }
  return added;
}
