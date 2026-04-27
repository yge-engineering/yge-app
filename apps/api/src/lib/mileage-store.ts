// File-based store for mileage entries.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  MileageEntrySchema,
  newMileageEntryId,
  type MileageEntry,
  type MileageEntryCreate,
  type MileageEntryPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.MILEAGE_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'mileage');
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

async function readIndex(): Promise<MileageEntry[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = MileageEntrySchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is MileageEntry => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: MileageEntry[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createMileageEntry(input: MileageEntryCreate): Promise<MileageEntry> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newMileageEntryId();
  const e: MileageEntry = {
    id,
    createdAt: now,
    updatedAt: now,
    purpose: input.purpose ?? 'JOBSITE_TRAVEL',
    isPersonalVehicle: input.isPersonalVehicle ?? false,
    reimbursed: input.reimbursed ?? false,
    ...input,
  };
  MileageEntrySchema.parse(e);
  await fs.writeFile(rowPath(id), JSON.stringify(e, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(e);
  await writeIndex(index);
  return e;
}

export async function listMileageEntries(filter?: {
  employeeId?: string;
  jobId?: string;
  reimbursed?: boolean;
}): Promise<MileageEntry[]> {
  let all = await readIndex();
  if (filter?.employeeId) all = all.filter((e) => e.employeeId === filter.employeeId);
  if (filter?.jobId) all = all.filter((e) => e.jobId === filter.jobId);
  if (filter?.reimbursed != null) all = all.filter((e) => e.reimbursed === filter.reimbursed);
  all.sort((a, b) => b.tripDate.localeCompare(a.tripDate));
  return all;
}

export async function getMileageEntry(id: string): Promise<MileageEntry | null> {
  if (!/^mi-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return MileageEntrySchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateMileageEntry(
  id: string,
  patch: MileageEntryPatch,
): Promise<MileageEntry | null> {
  const existing = await getMileageEntry(id);
  if (!existing) return null;
  const updated: MileageEntry = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  MileageEntrySchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((e) => e.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
