// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for daily weather logs.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  WeatherLogSchema,
  newWeatherLogId,
  type WeatherLog,
  type WeatherLogCreate,
  type WeatherLogPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.WEATHER_LOGS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'weather-logs');
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

async function readIndex(): Promise<WeatherLog[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = WeatherLogSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((w): w is WeatherLog => w !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: WeatherLog[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createWeatherLog(
  input: WeatherLogCreate,
  ctx?: AuditContext,
): Promise<WeatherLog> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newWeatherLogId();
  const w: WeatherLog = {
    id,
    createdAt: now,
    updatedAt: now,
    primaryCondition: input.primaryCondition ?? 'CLEAR',
    impact: input.impact ?? 'NONE',
    lostHours: input.lostHours ?? 0,
    heatProceduresActivated: input.heatProceduresActivated ?? false,
    highHeatProceduresActivated: input.highHeatProceduresActivated ?? false,
    ...input,
  };
  WeatherLogSchema.parse(w);
  await fs.writeFile(rowPath(id), JSON.stringify(w, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(w);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'WeatherLog',
    entityId: id,
    after: w,
    ctx,
  });
  return w;
}

export async function listWeatherLogs(filter?: {
  jobId?: string;
}): Promise<WeatherLog[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((w) => w.jobId === filter.jobId);
  all.sort((a, b) => b.observedOn.localeCompare(a.observedOn));
  return all;
}

export async function getWeatherLog(id: string): Promise<WeatherLog | null> {
  if (!/^wx-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return WeatherLogSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateWeatherLog(
  id: string,
  patch: WeatherLogPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<WeatherLog | null> {
  const existing = await getWeatherLog(id);
  if (!existing) return null;
  const updated: WeatherLog = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  WeatherLogSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((w) => w.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'WeatherLog',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
