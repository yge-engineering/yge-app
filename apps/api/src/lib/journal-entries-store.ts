// File-based store for journal entries.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  JournalEntrySchema,
  newJournalEntryId,
  type JournalEntry,
  type JournalEntryCreate,
  type JournalEntryPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.JOURNAL_ENTRIES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'journal-entries');
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

async function readIndex(): Promise<JournalEntry[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = JournalEntrySchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((j): j is JournalEntry => j !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: JournalEntry[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createJournalEntry(input: JournalEntryCreate): Promise<JournalEntry> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newJournalEntryId();
  const je: JournalEntry = {
    id,
    createdAt: now,
    updatedAt: now,
    source: input.source ?? 'MANUAL',
    status: input.status ?? 'DRAFT',
    ...input,
  };
  // Re-parse with the full schema (including the balance refine).
  JournalEntrySchema.parse(je);
  await fs.writeFile(rowPath(id), JSON.stringify(je, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(je);
  await writeIndex(index);
  return je;
}

export async function listJournalEntries(filter?: {
  status?: string;
  source?: string;
}): Promise<JournalEntry[]> {
  let all = await readIndex();
  if (filter?.status) all = all.filter((j) => j.status === filter.status);
  if (filter?.source) all = all.filter((j) => j.source === filter.source);
  all.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  return all;
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  if (!/^je-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return JournalEntrySchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateJournalEntry(
  id: string,
  patch: JournalEntryPatch,
): Promise<JournalEntry | null> {
  const existing = await getJournalEntry(id);
  if (!existing) return null;
  const updated: JournalEntry = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  JournalEntrySchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((j) => j.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
