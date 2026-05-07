// Postgres-backed store for daily reports.

import { prisma } from '@yge/db';
import {
  DailyReportSchema,
  newDailyReportId,
  type DailyReport,
  type DailyReportCreate,
  type DailyReportPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2dr(row: { data: unknown }): DailyReport {
  return DailyReportSchema.parse(row.data);
}

export async function createDailyReport(
  input: DailyReportCreate,
  ctx?: AuditContext,
): Promise<DailyReport> {
  const now = new Date().toISOString();
  const id = newDailyReportId(input.date);
  const r: DailyReport = {
    id,
    createdAt: now,
    updatedAt: now,
    crewOnSite: input.crewOnSite ?? [],
    photoCount: input.photoCount ?? 0,
    submitted: input.submitted ?? false,
    ...input,
  };
  DailyReportSchema.parse(r);
  await prisma.dailyReport.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: r.jobId,
      reportDate: r.date,
      data: r as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'DailyReport',
    entityId: id,
    after: r,
    ctx,
  });
  return r;
}

export async function listDailyReports(filter?: {
  jobId?: string;
  foremanId?: string;
}): Promise<DailyReport[]> {
  const rows = await prisma.dailyReport.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { reportDate: 'desc' },
  });
  let all = rows.map(row2dr);
  if (filter?.foremanId) all = all.filter((r) => r.foremanId === filter.foremanId);
  return all;
}

export async function getDailyReport(id: string): Promise<DailyReport | null> {
  if (!/^dr-\d{4}-\d{2}-\d{2}-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.dailyReport.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2dr(row) : null;
}

export async function updateDailyReport(
  id: string,
  patch: DailyReportPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'submit' = 'update',
): Promise<DailyReport | null> {
  const existing = await getDailyReport(id);
  if (!existing) return null;
  const updated: DailyReport = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DailyReportSchema.parse(updated);
  await prisma.dailyReport.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      reportDate: updated.date,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'DailyReport',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
