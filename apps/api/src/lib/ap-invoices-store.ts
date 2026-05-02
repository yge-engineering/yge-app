// File-based store for AP invoices.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. The audit
// write is fail-soft (a disk error in the audit store does not
// roll back the underlying mutation; see audit-store.ts).

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ApInvoiceSchema,
  newApInvoiceId,
  type ApInvoice,
  type ApInvoiceCreate,
  type ApInvoicePatch,
  type ApPaymentMethod,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.AP_INVOICES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'ap-invoices')
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

async function readIndex(): Promise<ApInvoice[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ApInvoiceSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((i): i is ApInvoice => i !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ApInvoice[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createApInvoice(
  input: ApInvoiceCreate,
  ctx?: AuditContext,
): Promise<ApInvoice> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newApInvoiceId();
  const i: ApInvoice = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    lineItems: input.lineItems ?? [],
    totalCents: input.totalCents ?? 0,
    paidCents: input.paidCents ?? 0,
    ...input,
  };
  ApInvoiceSchema.parse(i);
  await fs.writeFile(rowPath(id), JSON.stringify(i, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(i);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'ApInvoice',
    entityId: id,
    after: i,
    ctx,
  });
  return i;
}

export async function listApInvoices(filter?: {
  status?: string;
  jobId?: string;
}): Promise<ApInvoice[]> {
  let all = await readIndex();
  if (filter?.status) all = all.filter((i) => i.status === filter.status);
  if (filter?.jobId) all = all.filter((i) => i.jobId === filter.jobId);
  // Newest invoice date first.
  all.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  return all;
}

export async function getApInvoice(id: string): Promise<ApInvoice | null> {
  if (!/^ap-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ApInvoiceSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateApInvoice(
  id: string,
  patch: ApInvoicePatch,
  ctx?: AuditContext,
  /** Optional override of the audit action when the caller knows
   *  this is a domain-meaningful state change (approve / pay /
   *  reject) rather than a generic field edit. */
  auditAction: 'update' | 'approve' | 'pay' | 'reject' = 'update',
): Promise<ApInvoice | null> {
  const existing = await getApInvoice(id);
  if (!existing) return null;
  const updated: ApInvoice = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ApInvoiceSchema.parse(updated);
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
    entityType: 'ApInvoice',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Move from DRAFT/PENDING to APPROVED. */
export async function approveApInvoice(
  id: string,
  approvedByEmployeeId?: string,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  return updateApInvoice(
    id,
    {
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedByEmployeeId,
    },
    ctx,
    'approve',
  );
}

/** Apply a payment. Server-side state machine: paidCents adds the
 *  amount; status flips to PAID when paidCents >= totalCents. */
export async function payApInvoice(
  id: string,
  paidAt: string,
  paymentMethod: ApPaymentMethod,
  paymentReference: string | undefined,
  amountCents: number,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  const existing = await getApInvoice(id);
  if (!existing) return null;
  const newPaid = existing.paidCents + amountCents;
  const fullyPaid = newPaid >= existing.totalCents;
  return updateApInvoice(
    id,
    {
      paidCents: newPaid,
      paidAt,
      paymentMethod,
      paymentReference,
      status: fullyPaid ? 'PAID' : existing.status === 'DRAFT' ? 'APPROVED' : existing.status,
    },
    ctx,
    'pay',
  );
}

/** Reject an invoice with a reason. Terminal state. */
export async function rejectApInvoice(
  id: string,
  reason: string,
  ctx?: AuditContext,
): Promise<ApInvoice | null> {
  return updateApInvoice(
    id,
    {
      status: 'REJECTED',
      rejectedReason: reason,
    },
    { ...ctx, reason },
    'reject',
  );
}
