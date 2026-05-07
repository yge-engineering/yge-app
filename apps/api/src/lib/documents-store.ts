// Postgres-backed store for document metadata.

import { prisma } from '@yge/db';
import {
  DocumentSchema,
  newDocumentId,
  normalizeTag,
  type Document,
  type DocumentCreate,
  type DocumentPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function sanitizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const norm = normalizeTag(t);
    if (norm.length === 0 || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

function row2doc(row: { data: unknown }): Document {
  return DocumentSchema.parse(row.data);
}

export async function createDocument(
  input: DocumentCreate,
  ctx?: AuditContext,
): Promise<Document> {
  const now = new Date().toISOString();
  const id = newDocumentId();
  const d: Document = {
    id,
    createdAt: now,
    updatedAt: now,
    tags: sanitizeTags(input.tags),
    ...input,
  };
  d.tags = sanitizeTags(input.tags);
  DocumentSchema.parse(d);
  await prisma.document.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      folderId: d.folderId ?? null,
      data: d as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Document',
    entityId: id,
    after: d,
    ctx,
  });
  return d;
}

export async function listDocuments(filter?: {
  jobId?: string;
  kind?: string;
  tag?: string;
}): Promise<Document[]> {
  const rows = await prisma.document.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2doc);
  if (filter?.jobId) all = all.filter((d) => d.jobId === filter.jobId);
  if (filter?.kind) all = all.filter((d) => d.kind === filter.kind);
  if (filter?.tag) {
    const t = normalizeTag(filter.tag);
    all = all.filter((d) => d.tags.includes(t));
  }
  all.sort((a, b) => {
    const ad = a.documentDate ?? a.createdAt.slice(0, 10);
    const bd = b.documentDate ?? b.createdAt.slice(0, 10);
    return bd.localeCompare(ad);
  });
  return all;
}

export async function getDocument(id: string): Promise<Document | null> {
  if (!/^doc-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.document.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2doc(row) : null;
}

export async function updateDocument(
  id: string,
  patch: DocumentPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' | 'restore' = 'update',
): Promise<Document | null> {
  const existing = await getDocument(id);
  if (!existing) return null;
  const merged: Document = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  if (patch.tags !== undefined) merged.tags = sanitizeTags(patch.tags);
  DocumentSchema.parse(merged);
  await prisma.document.update({
    where: { id },
    data: {
      folderId: merged.folderId ?? null,
      data: merged as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Document',
    entityId: id,
    before: existing,
    after: merged,
    ctx,
  });
  return merged;
}
