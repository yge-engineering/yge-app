// Postgres-backed store for toolbox talks.

import { prisma } from '@yge/db';
import {
  ToolboxTalkSchema,
  newToolboxTalkId,
  type ToolboxTalk,
  type ToolboxTalkCreate,
  type ToolboxTalkPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2tbt(row: { data: unknown }): ToolboxTalk {
  return ToolboxTalkSchema.parse(row.data);
}

export async function createToolboxTalk(
  input: ToolboxTalkCreate,
  ctx?: AuditContext,
): Promise<ToolboxTalk> {
  const now = new Date().toISOString();
  const id = newToolboxTalkId();
  const t: ToolboxTalk = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    attendees: input.attendees ?? [],
    ...input,
  };
  ToolboxTalkSchema.parse(t);
  await prisma.toolboxTalk.create({
    data: {
      id,
      companyId: companyId(),
      data: t as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'ToolboxTalk',
    entityId: id,
    after: t,
    ctx,
  });
  return t;
}

export async function listToolboxTalks(filter?: {
  jobId?: string;
  status?: string;
}): Promise<ToolboxTalk[]> {
  const rows = await prisma.toolboxTalk.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2tbt);
  if (filter?.jobId) all = all.filter((t) => t.jobId === filter.jobId);
  if (filter?.status) all = all.filter((t) => t.status === filter.status);
  return all;
}

export async function getToolboxTalk(id: string): Promise<ToolboxTalk | null> {
  if (!/^tbt-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.toolboxTalk.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2tbt(row) : null;
}

export async function updateToolboxTalk(
  id: string,
  patch: ToolboxTalkPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<ToolboxTalk | null> {
  const existing = await getToolboxTalk(id);
  if (!existing) return null;
  const updated: ToolboxTalk = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ToolboxTalkSchema.parse(updated);
  await prisma.toolboxTalk.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'ToolboxTalk',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
