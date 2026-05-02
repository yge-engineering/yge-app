// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for vendors.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  VendorSchema,
  newVendorId,
  type Vendor,
  type VendorCreate,
  type VendorPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.VENDORS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'vendors');
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

async function readIndex(): Promise<Vendor[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = VendorSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((v): v is Vendor => v !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Vendor[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createVendor(
  input: VendorCreate,
  ctx?: AuditContext,
): Promise<Vendor> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newVendorId();
  const v: Vendor = {
    id,
    createdAt: now,
    updatedAt: now,
    paymentTerms: input.paymentTerms ?? 'NET_30',
    w9OnFile: input.w9OnFile ?? false,
    is1099Reportable: input.is1099Reportable ?? false,
    coiOnFile: input.coiOnFile ?? false,
    onHold: input.onHold ?? false,
    ...input,
  };
  VendorSchema.parse(v);
  await fs.writeFile(rowPath(id), JSON.stringify(v, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(v);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Vendor',
    entityId: id,
    after: v,
    ctx,
  });
  return v;
}

export async function listVendors(filter?: { kind?: string }): Promise<Vendor[]> {
  let all = await readIndex();
  if (filter?.kind) all = all.filter((v) => v.kind === filter.kind);
  all.sort((a, b) => a.legalName.localeCompare(b.legalName));
  return all;
}

export async function getVendor(id: string): Promise<Vendor | null> {
  if (!/^vnd-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return VendorSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateVendor(
  id: string,
  patch: VendorPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Vendor | null> {
  const existing = await getVendor(id);
  if (!existing) return null;
  const updated: Vendor = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  VendorSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((v) => v.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Vendor',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
