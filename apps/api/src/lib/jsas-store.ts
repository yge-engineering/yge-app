// Postgres-backed store for Job Safety Analysis records.

import { prisma } from '@yge/db';
import {
  JsaSchema,
  newJsaId,
  type Jsa,
  type JsaCreate,
  type JsaPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2jsa(row: { data: unknown }): Jsa {
  return JsaSchema.parse(row.data);
}

export async function createJsa(input: JsaCreate, ctx?: AuditContext): Promise<Jsa> {
  const now = new Date().toISOString();
  const id = newJsaId();
  const jsa: Jsa = {
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
    hazards: input.hazards ?? [],
    crewSignatures: input.crewSignatures ?? [],
    photoRefs: input.photoRefs ?? [],
  };
  JsaSchema.parse(jsa);
  await prisma.jsa.create({
    data: {
      id,
      companyId: companyId(),
      jobId: jsa.jobId,
      workDate: jsa.workDate,
      data: jsa as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Jsa',
    entityId: id,
    after: jsa,
    ctx,
  });
  return jsa;
}

export async function listJsas(filter?: {
  jobId?: string;
  workDate?: string;
}): Promise<Jsa[]> {
  const rows = await prisma.jsa.findMany({
    where: {
      companyId: companyId(),
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      ...(filter?.workDate ? { workDate: filter.workDate } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows
    .map(row2jsa)
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
}

export async function getJsa(id: string): Promise<Jsa | null> {
  if (!/^jsa-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.jsa.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2jsa(row) : null;
}

export async function updateJsa(
  id: string,
  patch: JsaPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<Jsa | null> {
  const existing = await getJsa(id);
  if (!existing) return null;
  const updated: Jsa = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    hazards: patch.hazards ?? existing.hazards,
    crewSignatures: patch.crewSignatures ?? existing.crewSignatures,
    photoRefs: patch.photoRefs ?? existing.photoRefs,
  };
  JsaSchema.parse(updated);
  await prisma.jsa.update({
    where: { id },
    data: {
      jobId: updated.jobId,
      workDate: updated.workDate,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Jsa',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
