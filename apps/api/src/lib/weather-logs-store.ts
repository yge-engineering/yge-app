// Postgres-backed store for weather logs.

import { prisma } from '@yge/db';
import {
  WeatherLogSchema,
  newWeatherLogId,
  type WeatherLog,
  type WeatherLogCreate,
  type WeatherLogPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2wx(row: { data: unknown }): WeatherLog {
  return WeatherLogSchema.parse(row.data);
}

export async function createWeatherLog(
  input: WeatherLogCreate,
  ctx?: AuditContext,
): Promise<WeatherLog> {
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
  await prisma.weatherLog.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: w.jobId,
      recordedAt: w.observedOn,
      data: w as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'WeatherLog',
    entityId: id,
    after: w,
    ctx,
  });
  return w;
}

export async function listWeatherLogs(filter?: { jobId?: string }): Promise<WeatherLog[]> {
  const rows = await prisma.weatherLog.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { recordedAt: 'desc' },
  });
  return rows.map(row2wx);
}

export async function getWeatherLog(id: string): Promise<WeatherLog | null> {
  if (!/^wx-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.weatherLog.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2wx(row) : null;
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
  await prisma.weatherLog.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      recordedAt: updated.observedOn,
      data: updated as unknown as object,
    },
  });
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
