// Postgres-backed store for journal entries.

import { prisma } from '@yge/db';
import {
  JournalEntrySchema,
  newJournalEntryId,
  type JournalEntry,
  type JournalEntryCreate,
  type JournalEntryPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2je(row: { data: unknown }): JournalEntry {
  return JournalEntrySchema.parse(row.data);
}

export async function createJournalEntry(
  input: JournalEntryCreate,
  ctx?: AuditContext,
): Promise<JournalEntry> {
  const now = new Date().toISOString();
  const id = newJournalEntryId();
  const je: JournalEntry = {
    id,
    createdAt: now,
    updatedAt: now,
    source: input.source ?? 'MANUAL',
    status: input.status ?? 'DRAFT',
    ...input,
  };
  JournalEntrySchema.parse(je);
  await prisma.journalEntry.create({
    data: {
      id,
      companyId: companyId(),
      data: je as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'JournalEntry',
    entityId: id,
    after: je,
    ctx,
  });
  return je;
}

export async function listJournalEntries(filter?: {
  status?: string;
  source?: string;
}): Promise<JournalEntry[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2je);
  if (filter?.status) all = all.filter((j) => j.status === filter.status);
  if (filter?.source) all = all.filter((j) => j.source === filter.source);
  return all;
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  if (!/^je-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.journalEntry.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? row2je(row) : null;
}

export async function updateJournalEntry(
  id: string,
  patch: JournalEntryPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'post' | 'unpost' | 'void' = 'update',
): Promise<JournalEntry | null> {
  const existing = await getJournalEntry(id);
  if (!existing) return null;
  const updated: JournalEntry = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  JournalEntrySchema.parse(updated);
  await prisma.journalEntry.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'JournalEntry',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
