// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for OSHA 300/301 incidents.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  IncidentSchema,
  newIncidentId,
  type Incident,
  type IncidentCreate,
  type IncidentPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.INCIDENTS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'incidents');
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

async function readIndex(): Promise<Incident[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = IncidentSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((i): i is Incident => i !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Incident[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createIncident(
  input: IncidentCreate,
  ctx?: AuditContext,
): Promise<Incident> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newIncidentId();
  const inc: Incident = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'OPEN',
    daysAway: input.daysAway ?? 0,
    daysRestricted: input.daysRestricted ?? 0,
    privacyCase: input.privacyCase ?? false,
    died: input.died ?? false,
    treatedInER: input.treatedInER ?? false,
    hospitalizedOvernight: input.hospitalizedOvernight ?? false,
    calOshaReported: input.calOshaReported ?? false,
    ...input,
  };
  IncidentSchema.parse(inc);
  await fs.writeFile(rowPath(id), JSON.stringify(inc, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(inc);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Incident',
    entityId: id,
    after: inc,
    ctx,
  });
  return inc;
}

export async function listIncidents(filter?: {
  logYear?: number;
  status?: string;
  jobId?: string;
}): Promise<Incident[]> {
  let all = await readIndex();
  if (filter?.logYear != null) all = all.filter((i) => i.logYear === filter.logYear);
  if (filter?.status) all = all.filter((i) => i.status === filter.status);
  if (filter?.jobId) all = all.filter((i) => i.jobId === filter.jobId);
  all.sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
  return all;
}

export async function getIncident(id: string): Promise<Incident | null> {
  if (!/^inc-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return IncidentSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateIncident(
  id: string,
  patch: IncidentPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<Incident | null> {
  const existing = await getIncident(id);
  if (!existing) return null;
  const updated: Incident = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  IncidentSchema.parse(updated);
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
    entityType: 'Incident',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
