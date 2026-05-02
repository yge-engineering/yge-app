// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for SWPPP/BMP inspections.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  SwpppInspectionSchema,
  newSwpppInspectionId,
  type SwpppInspection,
  type SwpppInspectionCreate,
  type SwpppInspectionPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.SWPPP_INSPECTIONS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'swppp-inspections');
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

async function readIndex(): Promise<SwpppInspection[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = SwpppInspectionSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((s): s is SwpppInspection => s !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: SwpppInspection[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createSwpppInspection(
  input: SwpppInspectionCreate,
  ctx?: AuditContext,
): Promise<SwpppInspection> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newSwpppInspectionId();
  const s: SwpppInspection = {
    id,
    createdAt: now,
    updatedAt: now,
    trigger: input.trigger ?? 'WEEKLY',
    rainForecast: input.rainForecast ?? false,
    qualifyingRainEvent: input.qualifyingRainEvent ?? false,
    dischargeOccurred: input.dischargeOccurred ?? false,
    bmpChecks: input.bmpChecks ?? [],
    ...input,
  };
  SwpppInspectionSchema.parse(s);
  await fs.writeFile(rowPath(id), JSON.stringify(s, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(s);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'SwpppInspection',
    entityId: id,
    after: s,
    ctx,
  });
  return s;
}

export async function listSwpppInspections(filter?: {
  jobId?: string;
}): Promise<SwpppInspection[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((s) => s.jobId === filter.jobId);
  all.sort((a, b) => b.inspectedOn.localeCompare(a.inspectedOn));
  return all;
}

export async function getSwpppInspection(id: string): Promise<SwpppInspection | null> {
  if (!/^swp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return SwpppInspectionSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateSwpppInspection(
  id: string,
  patch: SwpppInspectionPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<SwpppInspection | null> {
  const existing = await getSwpppInspection(id);
  if (!existing) return null;
  const updated: SwpppInspection = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  SwpppInspectionSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((s) => s.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'SwpppInspection',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
