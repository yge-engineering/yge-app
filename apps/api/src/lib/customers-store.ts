// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for customers.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CustomerSchema,
  newCustomerId,
  type Customer,
  type CustomerCreate,
  type CustomerPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.CUSTOMERS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'customers');
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

async function readIndex(): Promise<Customer[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = CustomerSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((c): c is Customer => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Customer[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createCustomer(
  input: CustomerCreate,
  ctx?: AuditContext,
): Promise<Customer> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newCustomerId();
  const c: Customer = {
    id,
    createdAt: now,
    updatedAt: now,
    taxExempt: input.taxExempt ?? false,
    onHold: input.onHold ?? false,
    ...input,
  };
  CustomerSchema.parse(c);
  await fs.writeFile(rowPath(id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(c);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Customer',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCustomers(filter?: {
  kind?: string;
}): Promise<Customer[]> {
  let all = await readIndex();
  if (filter?.kind) all = all.filter((c) => c.kind === filter.kind);
  all.sort((a, b) => a.legalName.localeCompare(b.legalName));
  return all;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  if (!/^cus-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return CustomerSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateCustomer(
  id: string,
  patch: CustomerPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Customer | null> {
  const existing = await getCustomer(id);
  if (!existing) return null;
  const updated: Customer = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CustomerSchema.parse(updated);
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
    entityType: 'Customer',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
