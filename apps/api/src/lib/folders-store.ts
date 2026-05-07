// Postgres-backed store for folder metadata.

import { prisma } from '@yge/db';
import {
  FolderSchema,
  newFolderId,
  type Folder,
  type FolderCreate,
  type FolderPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2folder(row: { data: unknown }): Folder {
  return FolderSchema.parse(row.data);
}

export async function listFolders(): Promise<Folder[]> {
  const rows = await prisma.folder.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { name: 'asc' },
  });
  return rows.map(row2folder);
}

export async function getFolder(id: string): Promise<Folder | null> {
  if (!/^fld-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.folder.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2folder(row) : null;
}

export async function createFolder(
  input: FolderCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = FolderSchema.parse({
    ...input,
    id: newFolderId(),
    createdAt: now,
    updatedAt: now,
  });
  await prisma.folder.create({
    data: {
      id: folder.id,
      companyId: companyId(),
      parentId: folder.parentFolderId ?? null,
      name: folder.name,
      data: folder as unknown as object,
    },
  });
  await recordAudit({
    entityType: 'Folder',
    entityId: folder.id,
    action: 'create',
    after: folder,
    ctx,
  });
  return folder;
}

export async function updateFolder(
  id: string,
  patch: FolderPatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<Folder | null> {
  const existing = await getFolder(id);
  if (!existing) return null;
  if (patch.parentFolderId === id) {
    throw new Error('Folder cannot be its own parent');
  }
  if (patch.parentFolderId) {
    const folders = await listFolders();
    const byId = new Map(folders.map((f) => [f.id, f]));
    let cursor: Folder | undefined = byId.get(patch.parentFolderId);
    let safety = 64;
    while (cursor && safety-- > 0) {
      if (cursor.id === id) {
        throw new Error('Cannot move folder under its own descendant');
      }
      cursor = cursor.parentFolderId ? byId.get(cursor.parentFolderId) : undefined;
    }
  }
  const updated: Folder = FolderSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await prisma.folder.update({
    where: { id },
    data: {
      parentId: updated.parentFolderId ?? null,
      name: updated.name,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    entityType: 'Folder',
    entityId: id,
    action: 'update',
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

export async function deleteFolder(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getFolder(id);
  if (!existing) return false;
  // Reparent direct children to the deleted folder's parent.
  const children = await prisma.folder.findMany({
    where: { companyId: companyId(), parentId: id, deletedAt: null },
  });
  for (const child of children) {
    const childFolder = row2folder(child);
    const newParent = existing.parentFolderId ?? null;
    const reparented: Folder = {
      ...childFolder,
      parentFolderId: newParent,
      updatedAt: new Date().toISOString(),
    };
    await prisma.folder.update({
      where: { id: child.id },
      data: {
        parentId: newParent,
        data: reparented as unknown as object,
      },
    });
  }
  await prisma.folder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    entityType: 'Folder',
    entityId: id,
    action: 'delete',
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
