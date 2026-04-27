// File-based store for AP payments (the check register).

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ApPaymentSchema,
  newApPaymentId,
  sumApPaymentsForInvoice,
  type ApPayment,
  type ApPaymentCreate,
  type ApPaymentPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.AP_PAYMENTS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'ap-payments');
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

async function readIndex(): Promise<ApPayment[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ApPaymentSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((p): p is ApPayment => p !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ApPayment[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createApPayment(input: ApPaymentCreate): Promise<ApPayment> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newApPaymentId();
  const p: ApPayment = {
    id,
    createdAt: now,
    updatedAt: now,
    method: input.method ?? 'CHECK',
    cleared: input.cleared ?? false,
    voided: input.voided ?? false,
    ...input,
  };
  ApPaymentSchema.parse(p);
  await fs.writeFile(rowPath(id), JSON.stringify(p, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(p);
  await writeIndex(index);
  return p;
}

export async function listApPayments(filter?: {
  apInvoiceId?: string;
  method?: string;
}): Promise<ApPayment[]> {
  let all = await readIndex();
  if (filter?.apInvoiceId) all = all.filter((p) => p.apInvoiceId === filter.apInvoiceId);
  if (filter?.method) all = all.filter((p) => p.method === filter.method);
  all.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  return all;
}

export async function getApPayment(id: string): Promise<ApPayment | null> {
  if (!/^app-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ApPaymentSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateApPayment(
  id: string,
  patch: ApPaymentPatch,
): Promise<ApPayment | null> {
  const existing = await getApPayment(id);
  if (!existing) return null;
  const updated: ApPayment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ApPaymentSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((p) => p.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}

/** Sum of non-voided payments applied to an invoice — drives the
 *  AP-invoice paidCents value when we re-derive on display. */
export async function totalPaidForApInvoice(apInvoiceId: string): Promise<number> {
  const all = await readIndex();
  return sumApPaymentsForInvoice(apInvoiceId, all);
}
