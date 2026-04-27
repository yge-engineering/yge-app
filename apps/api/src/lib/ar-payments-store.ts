// File-based store for AR payments.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ArPaymentSchema,
  newArPaymentId,
  sumPaymentsForInvoice,
  type ArPayment,
  type ArPaymentCreate,
  type ArPaymentPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.AR_PAYMENTS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'ar-payments');
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

async function readIndex(): Promise<ArPayment[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ArPaymentSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((p): p is ArPayment => p !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ArPayment[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createArPayment(input: ArPaymentCreate): Promise<ArPayment> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newArPaymentId();
  const p: ArPayment = {
    id,
    createdAt: now,
    updatedAt: now,
    kind: input.kind ?? 'PROGRESS',
    method: input.method ?? 'CHECK',
    ...input,
  };
  ArPaymentSchema.parse(p);
  await fs.writeFile(rowPath(id), JSON.stringify(p, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(p);
  await writeIndex(index);
  return p;
}

export async function listArPayments(filter?: {
  arInvoiceId?: string;
  jobId?: string;
}): Promise<ArPayment[]> {
  let all = await readIndex();
  if (filter?.arInvoiceId) all = all.filter((p) => p.arInvoiceId === filter.arInvoiceId);
  if (filter?.jobId) all = all.filter((p) => p.jobId === filter.jobId);
  all.sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
  return all;
}

export async function getArPayment(id: string): Promise<ArPayment | null> {
  if (!/^arp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ArPaymentSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateArPayment(
  id: string,
  patch: ArPaymentPatch,
): Promise<ArPayment | null> {
  const existing = await getArPayment(id);
  if (!existing) return null;
  const updated: ArPayment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ArPaymentSchema.parse(updated);
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

/** Convenience used by the AR-invoice routes when applying a payment:
 *  returns the running paid total for an invoice. */
export async function totalPaidForInvoice(arInvoiceId: string): Promise<number> {
  const all = await readIndex();
  return sumPaymentsForInvoice(arInvoiceId, all);
}
