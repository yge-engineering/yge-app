// File-based store for bank reconciliations.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  BankRecSchema,
  newBankRecId,
  type BankRec,
  type BankRecCreate,
  type BankRecPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.BANK_RECS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'bank-recs');
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

async function readIndex(): Promise<BankRec[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = BankRecSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((r): r is BankRec => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: BankRec[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createBankRec(input: BankRecCreate): Promise<BankRec> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newBankRecId();
  const r: BankRec = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    outstandingChecksCents: input.outstandingChecksCents ?? 0,
    outstandingDepositsCents: input.outstandingDepositsCents ?? 0,
    adjustments: input.adjustments ?? [],
    ...input,
  };
  BankRecSchema.parse(r);
  await fs.writeFile(rowPath(id), JSON.stringify(r, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(r);
  await writeIndex(index);
  return r;
}

export async function listBankRecs(filter?: {
  bankAccountLabel?: string;
  status?: string;
}): Promise<BankRec[]> {
  let all = await readIndex();
  if (filter?.bankAccountLabel)
    all = all.filter((r) => r.bankAccountLabel === filter.bankAccountLabel);
  if (filter?.status) all = all.filter((r) => r.status === filter.status);
  all.sort((a, b) => b.statementDate.localeCompare(a.statementDate));
  return all;
}

export async function getBankRec(id: string): Promise<BankRec | null> {
  if (!/^bnk-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return BankRecSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateBankRec(
  id: string,
  patch: BankRecPatch,
): Promise<BankRec | null> {
  const existing = await getBankRec(id);
  if (!existing) return null;
  const updated: BankRec = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  BankRecSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((r) => r.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
