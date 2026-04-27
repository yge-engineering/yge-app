// File-based store for DIR prevailing wage rates.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DirRateSchema,
  newDirRateId,
  type DirRate,
  type DirRateCreate,
  type DirRatePatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.DIR_RATES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'dir-rates');
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

async function readIndex(): Promise<DirRate[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = DirRateSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((r): r is DirRate => r !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: DirRate[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createDirRate(input: DirRateCreate): Promise<DirRate> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newDirRateId();
  const r: DirRate = {
    id,
    createdAt: now,
    updatedAt: now,
    healthAndWelfareCents: input.healthAndWelfareCents ?? 0,
    pensionCents: input.pensionCents ?? 0,
    vacationHolidayCents: input.vacationHolidayCents ?? 0,
    trainingCents: input.trainingCents ?? 0,
    otherFringeCents: input.otherFringeCents ?? 0,
    ...input,
  };
  DirRateSchema.parse(r);
  await fs.writeFile(rowPath(id), JSON.stringify(r, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(r);
  await writeIndex(index);
  return r;
}

export async function listDirRates(filter?: {
  classification?: string;
  county?: string;
}): Promise<DirRate[]> {
  let all = await readIndex();
  if (filter?.classification)
    all = all.filter((r) => r.classification === filter.classification);
  if (filter?.county) all = all.filter((r) => r.county === filter.county);
  all.sort((a, b) => {
    const c = a.classification.localeCompare(b.classification);
    if (c !== 0) return c;
    const co = a.county.localeCompare(b.county);
    if (co !== 0) return co;
    return b.effectiveDate.localeCompare(a.effectiveDate);
  });
  return all;
}

export async function getDirRate(id: string): Promise<DirRate | null> {
  if (!/^dir-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return DirRateSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateDirRate(
  id: string,
  patch: DirRatePatch,
): Promise<DirRate | null> {
  const existing = await getDirRate(id);
  if (!existing) return null;
  const updated: DirRate = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DirRateSchema.parse(updated);
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
