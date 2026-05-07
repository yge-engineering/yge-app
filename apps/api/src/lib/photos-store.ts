// Postgres-backed store for photo metadata.

import { prisma } from '@yge/db';
import {
  PhotoSchema,
  newPhotoId,
  type Photo,
  type PhotoCreate,
  type PhotoPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2photo(row: { data: unknown }): Photo {
  return PhotoSchema.parse(row.data);
}

export async function createPhoto(
  input: PhotoCreate,
  ctx?: AuditContext,
): Promise<Photo> {
  const now = new Date().toISOString();
  const id = newPhotoId();
  const p: Photo = {
    id,
    createdAt: now,
    updatedAt: now,
    category: input.category ?? 'PROGRESS',
    ...input,
  };
  PhotoSchema.parse(p);
  await prisma.photo.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: p.jobId,
      data: p as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Photo',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPhotos(filter?: {
  jobId?: string;
  category?: string;
}): Promise<Photo[]> {
  const rows = await prisma.photo.findMany({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      deletedAt: null,
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2photo);
  if (filter?.category) all = all.filter((p) => p.category === filter.category);
  all.sort((a, b) => b.takenOn.localeCompare(a.takenOn));
  return all;
}

export async function getPhoto(id: string): Promise<Photo | null> {
  if (!/^ph-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.photo.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2photo(row) : null;
}

export async function updatePhoto(
  id: string,
  patch: PhotoPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<Photo | null> {
  const existing = await getPhoto(id);
  if (!existing) return null;
  const updated: Photo = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PhotoSchema.parse(updated);
  await prisma.photo.update({
    where: { id },
    data: { jobId: updated.jobId, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Photo',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
