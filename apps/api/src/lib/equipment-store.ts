// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for equipment + vehicles.
//
// Phase 1 stand-in for the future Postgres `Equipment` table. The
// dispatch helpers (assignEquipment / returnEquipment) keep status +
// assignment fields in lockstep so the UI never sees a half-state row.
// logMaintenance() pushes a new entry and updates lastServiceUsage in a
// single write.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  EquipmentSchema,
  newEquipmentId,
  type Equipment,
  type EquipmentCreate,
  type EquipmentPatch,
  type MaintenanceLogEntry,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.EQUIPMENT_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'equipment')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function unitPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Equipment[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = EquipmentSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is Equipment => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Equipment[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createEquipment(
  input: EquipmentCreate,
  ctx?: AuditContext,
): Promise<Equipment> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newEquipmentId();
  const e: Equipment = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'IN_YARD',
    currentUsage: input.currentUsage ?? 0,
    maintenanceLog: input.maintenanceLog ?? [],
    ...input,
  };
  EquipmentSchema.parse(e);
  await fs.writeFile(unitPath(id), JSON.stringify(e, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(e);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Equipment',
    entityId: id,
    after: e,
    ctx,
  });
  return e;
}

export async function listEquipment(): Promise<Equipment[]> {
  return readIndex();
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  if (!/^eq-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(unitPath(id), 'utf8');
    return EquipmentSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateEquipment(
  id: string,
  patch: EquipmentPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Equipment | null> {
  const existing = await getEquipment(id);
  if (!existing) return null;
  const updated: Equipment = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  EquipmentSchema.parse(updated);
  await fs.writeFile(unitPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((e) => e.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Equipment',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Assign equipment to a job (and optionally an operator). */
export async function assignEquipment(
  id: string,
  jobId: string,
  operatorEmployeeId?: string,
): Promise<Equipment | null> {
  return updateEquipment(id, {
    status: 'ASSIGNED',
    assignedJobId: jobId,
    assignedOperatorEmployeeId: operatorEmployeeId,
    assignedAt: new Date().toISOString(),
  });
}

/** Return to yard / shop / repair, clearing the assignment fields. */
export async function returnEquipment(
  id: string,
  destination: 'IN_YARD' | 'IN_SERVICE' | 'OUT_FOR_REPAIR' = 'IN_YARD',
): Promise<Equipment | null> {
  return updateEquipment(id, {
    status: destination,
    assignedJobId: undefined,
    assignedOperatorEmployeeId: undefined,
    assignedAt: undefined,
  });
}

/** Append a maintenance log entry and roll lastServiceUsage forward. */
export async function logMaintenance(
  id: string,
  entry: MaintenanceLogEntry,
): Promise<Equipment | null> {
  const existing = await getEquipment(id);
  if (!existing) return null;
  const log = [...existing.maintenanceLog, entry];
  return updateEquipment(id, {
    maintenanceLog: log,
    // Bump the lastServiceUsage forward so the next-service-due math
    // resets. We update currentUsage too if the entry's reading is
    // higher than what's on file; otherwise the foreman is logging
    // historical data and we leave currentUsage alone.
    lastServiceUsage: entry.usageAtService,
    currentUsage: Math.max(existing.currentUsage, entry.usageAtService),
  });
}
