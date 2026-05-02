// File-based store for AR invoices.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ArInvoiceSchema,
  newArInvoiceId,
  type ArInvoice,
  type ArInvoiceCreate,
  type ArInvoicePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.AR_INVOICES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'ar-invoices')
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

async function readIndex(): Promise<ArInvoice[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ArInvoiceSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((i): i is ArInvoice => i !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ArInvoice[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createArInvoice(
  input: ArInvoiceCreate,
  ctx?: AuditContext,
): Promise<ArInvoice> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newArInvoiceId();
  const i: ArInvoice = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    source: input.source ?? 'MANUAL',
    lineItems: input.lineItems ?? [],
    subtotalCents: input.subtotalCents ?? 0,
    totalCents: input.totalCents ?? 0,
    paidCents: input.paidCents ?? 0,
    ...input,
  };
  ArInvoiceSchema.parse(i);
  await fs.writeFile(rowPath(id), JSON.stringify(i, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(i);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'ArInvoice',
    entityId: id,
    after: i,
    ctx,
  });
  return i;
}

export async function listArInvoices(filter?: {
  status?: string;
  jobId?: string;
}): Promise<ArInvoice[]> {
  let all = await readIndex();
  if (filter?.status) all = all.filter((i) => i.status === filter.status);
  if (filter?.jobId) all = all.filter((i) => i.jobId === filter.jobId);
  all.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  return all;
}

export async function getArInvoice(id: string): Promise<ArInvoice | null> {
  if (!/^ar-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ArInvoiceSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateArInvoice(
  id: string,
  patch: ArInvoicePatch,
  ctx?: AuditContext,
  /** Override when the patch represents a domain action (approve /
   *  void / pay) rather than a generic field edit. */
  auditAction: 'update' | 'approve' | 'void' | 'pay' = 'update',
): Promise<ArInvoice | null> {
  const existing = await getArInvoice(id);
  if (!existing) return null;
  const updated: ArInvoice = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ArInvoiceSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((i) => i.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'ArInvoice',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
