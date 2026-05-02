// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for change orders.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ChangeOrderSchema,
  newChangeOrderId,
  recomputeChangeOrderTotals,
  type ChangeOrder,
  type ChangeOrderCreate,
  type ChangeOrderPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.CHANGE_ORDERS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'change-orders')
  );
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

async function readIndex(): Promise<ChangeOrder[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ChangeOrderSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((c): c is ChangeOrder => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ChangeOrder[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createChangeOrder(
  input: ChangeOrderCreate,
  ctx?: AuditContext,
): Promise<ChangeOrder> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newChangeOrderId();
  const lineItems = input.lineItems ?? [];
  const totals = recomputeChangeOrderTotals(lineItems);
  const c: ChangeOrder = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'PROPOSED',
    reason: input.reason ?? 'OWNER_DIRECTED',
    description: input.description ?? '',
    lineItems,
    totalCostImpactCents: input.totalCostImpactCents ?? totals.totalCostImpactCents,
    totalScheduleImpactDays: input.totalScheduleImpactDays ?? totals.totalScheduleImpactDays,
    ...input,
  };
  ChangeOrderSchema.parse(c);
  await fs.writeFile(rowPath(id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(c);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'ChangeOrder',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listChangeOrders(filter?: {
  jobId?: string;
  status?: string;
}): Promise<ChangeOrder[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((c) => c.jobId === filter.jobId);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all;
}

export async function getChangeOrder(id: string): Promise<ChangeOrder | null> {
  if (!/^co-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ChangeOrderSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateChangeOrder(
  id: string,
  patch: ChangeOrderPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' | 'approve' | 'reject' | 'void' = 'update',
): Promise<ChangeOrder | null> {
  const existing = await getChangeOrder(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  // If line items changed, recompute totals.
  if (patch.lineItems !== undefined) {
    const totals = recomputeChangeOrderTotals(patch.lineItems);
    merged.totalCostImpactCents = totals.totalCostImpactCents;
    merged.totalScheduleImpactDays = totals.totalScheduleImpactDays;
  }
  const updated: ChangeOrder = {
    ...merged,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ChangeOrderSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'ChangeOrder',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
