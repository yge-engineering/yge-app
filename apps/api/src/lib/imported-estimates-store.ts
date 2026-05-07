// Postgres-backed store for imported estimates.

import { prisma } from '@yge/db';
import {
  ImportedEstimateSchema,
  newImportedEstimateId,
  type ImportedEstimate,
  type ImportedEstimateCreate,
  type ImportedEstimatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2est(row: { data: unknown }): ImportedEstimate {
  return ImportedEstimateSchema.parse(row.data);
}

export async function listImportedEstimates(): Promise<ImportedEstimate[]> {
  const rows = await prisma.importedEstimate.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { jobNumber: 'asc' },
  });
  return rows.map(row2est);
}

export async function getImportedEstimate(id: string): Promise<ImportedEstimate | null> {
  const row = await prisma.importedEstimate.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2est(row) : null;
}

export async function createImportedEstimate(
  input: ImportedEstimateCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<ImportedEstimate> {
  const now = new Date().toISOString();
  const row = ImportedEstimateSchema.parse({
    ...input,
    id: newImportedEstimateId(),
    createdAt: now,
    updatedAt: now,
  });
  await prisma.importedEstimate.create({
    data: {
      id: row.id,
      companyId: companyId(),
      jobNumber: row.jobNumber,
      data: row as unknown as object,
    },
  });
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
  await prisma.importedEstimate.update({
    where: { id },
    data: {
      jobNumber: merged.jobNumber,
      data: merged as unknown as object,
    },
  });
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
  await prisma.importedEstimate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
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
