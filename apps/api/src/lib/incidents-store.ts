// Postgres-backed store for incidents.

import { prisma } from '@yge/db';
import {
  IncidentSchema,
  newIncidentId,
  type Incident,
  type IncidentCreate,
  type IncidentPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2inc(row: { data: unknown }): Incident {
  return IncidentSchema.parse(row.data);
}

export async function createIncident(
  input: IncidentCreate,
  ctx?: AuditContext,
): Promise<Incident> {
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
  await prisma.incident.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: inc.jobId ?? null,
      occurredAt: inc.incidentDate,
      data: inc as unknown as object,
    },
  });
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
  const rows = await prisma.incident.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { occurredAt: 'desc' },
  });
  let all = rows.map(row2inc);
  if (filter?.logYear != null) all = all.filter((i) => i.logYear === filter.logYear);
  if (filter?.status) all = all.filter((i) => i.status === filter.status);
  return all;
}

export async function getIncident(id: string): Promise<Incident | null> {
  if (!/^inc-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.incident.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2inc(row) : null;
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
  await prisma.incident.update({
    where: { id },
    data: {
      jobId: updated.jobId ?? null,
      occurredAt: updated.incidentDate,
      data: updated as unknown as object,
    },
  });
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
