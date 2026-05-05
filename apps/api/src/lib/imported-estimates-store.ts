// Imported estimates store — file-backed CRUD.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ImportedEstimateSchema,
  newImportedEstimateId,
  type ImportedEstimate,
  type ImportedEstimateCreate,
  type ImportedEstimatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.IMPORTED_ESTIMATES_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'imported-estimates');
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<ImportedEstimate[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e: unknown) => ImportedEstimateSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: ImportedEstimate }).data);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
async function writeIndex(rows: ImportedEstimate[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

export async function listImportedEstimates(): Promise<ImportedEstimate[]> {
  await ensureDir();
  const rows = await readIndex();
  return rows.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
}

export async function getImportedEstimate(id: string): Promise<ImportedEstimate | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    const r = ImportedEstimateSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createImportedEstimate(
  input: ImportedEstimateCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<ImportedEstimate> {
  await ensureDir();
  const now = new Date().toISOString();
  const row = ImportedEstimateSchema.parse({
    ...input,
    id: newImportedEstimateId(),
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(rowPath(row.id), JSON.stringify(row, null, 2), 'utf8');
  const idx = await readIndex();
  // Index keeps a summary (no `lines`) to keep memory + on-disk size
  // sane when there are many estimates with hundreds of lines each.
  idx.push({ ...row, lines: [] });
  await writeIndex(idx);
  await recordAudit({
    entityType: 'ImportedEstimate',
    entityId: row.id,
    action: 'create',
    before: null,
    after: { ...row, lines: `[${row.lines.length} lines]` },
    ctx,
  });
  return row;
}

export async function updateImportedEstimate(
  id: string,
  patch: ImportedEstimatePatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<ImportedEstimate | null> {
  const existing = await getImportedEstimate(id);
  if (!existing) return null;
  const merged = ImportedEstimateSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(rowPath(id), JSON.stringify(merged, null, 2), 'utf8');
  const idx = await readIndex();
  const i = idx.findIndex((r) => r.id === id);
  if (i >= 0) idx[i] = { ...merged, lines: [] }; else idx.push({ ...merged, lines: [] });
  await writeIndex(idx);
  await recordAudit({
    entityType: 'ImportedEstimate',
    entityId: id,
    action: 'update',
    before: { ...existing, lines: `[${existing.lines.length} lines]` },
    after: { ...merged, lines: `[${merged.lines.length} lines]` },
    ctx,
  });
  return merged;
}

export async function deleteImportedEstimate(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getImportedEstimate(id);
  if (!existing) return false;
  await fs.unlink(rowPath(id)).catch(() => undefined);
  const idx = await readIndex();
  await writeIndex(idx.filter((r) => r.id !== id));
  await recordAudit({
    entityType: 'ImportedEstimate',
    entityId: id,
    action: 'delete',
    before: { ...existing, lines: `[${existing.lines.length} lines]` },
    after: null,
    ctx,
  });
  return true;
}
