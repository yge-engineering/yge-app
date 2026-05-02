// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for the chart of accounts.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  AccountSchema,
  DEFAULT_COA_SEED,
  newAccountId,
  type Account,
  type AccountCreate,
  type AccountPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.COA_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'coa');
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

async function readIndex(): Promise<Account[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = AccountSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((a): a is Account => a !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Account[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createAccount(
  input: AccountCreate,
  ctx?: AuditContext,
): Promise<Account> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newAccountId();
  const a: Account = {
    id,
    createdAt: now,
    updatedAt: now,
    active: input.active ?? true,
    ...input,
  };
  AccountSchema.parse(a);
  await fs.writeFile(rowPath(id), JSON.stringify(a, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(a);
  await writeIndex(index);
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
  let all = await readIndex();
  if (filter?.type) all = all.filter((a) => a.type === filter.type);
  if (filter?.active != null) all = all.filter((a) => a.active === filter.active);
  all.sort((a, b) => a.number.localeCompare(b.number));
  return all;
}

export async function getAccount(id: string): Promise<Account | null> {
  if (!/^acc-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return AccountSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateAccount(
  id: string,
  patch: AccountPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Account | null> {
  const existing = await getAccount(id);
  if (!existing) return null;
  const updated: Account = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  AccountSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((a) => a.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
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

/** Apply the default COA seed. Skips any account number that already
 *  exists so this is idempotent + safe to re-run. Returns the list of
 *  accounts added. */
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
