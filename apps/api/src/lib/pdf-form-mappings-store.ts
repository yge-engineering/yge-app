// Postgres-backed store for PDF form mappings.
//
// Uses the PdfFormMapping model added in 1345 (companyId + agency
// metadata columns + Json data). Seeds the curated agency library
// from listSeedMappings() on first read per company.
//
// Mappings are downstream of YGE's identity (master profile) but
// upstream of every filled form, so every mutation is audited.

import { prisma } from '@yge/db';
import {
  PdfFormMappingSchema,
  newPdfFormMappingId,
  type PdfFormAgency,
  type PdfFormMapping,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { buildSeedMapping, listSeedMappings } from './pdf-form-mappings-seeds';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2mapping(row: { data: unknown }): PdfFormMapping {
  return PdfFormMappingSchema.parse(row.data);
}

async function seedIfEmpty(): Promise<void> {
  const existingIds = new Set(
    (
      await prisma.pdfFormMapping.findMany({
        where: { companyId: DEFAULT_COMPANY_ID },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const seeds = listSeedMappings();
  const now = new Date();
  for (const s of seeds) {
    if (existingIds.has(s.id)) continue;
    const mapping = PdfFormMappingSchema.parse(buildSeedMapping(s, now));
    await prisma.pdfFormMapping.create({
      data: {
        id: mapping.id,
        companyId: DEFAULT_COMPANY_ID,
        agency: mapping.agency,
        formCode: mapping.formCode ?? null,
        reviewed: mapping.reviewed,
        data: mapping as unknown as object,
      },
    });
  }
}

export interface ListPdfFormMappingsFilter {
  agency?: PdfFormAgency;
  reviewed?: boolean;
  /** Substring match against displayName + formCode (case-insensitive). */
  search?: string;
}

export async function listPdfFormMappings(
  filter: ListPdfFormMappingsFilter = {},
): Promise<PdfFormMapping[]> {
  await seedIfEmpty();
  const where: {
    companyId: string;
    deletedAt: null;
    agency?: PdfFormAgency;
    reviewed?: boolean;
  } = {
    companyId: DEFAULT_COMPANY_ID,
    deletedAt: null,
  };
  if (filter.agency) where.agency = filter.agency;
  if (filter.reviewed !== undefined) where.reviewed = filter.reviewed;
  const rows = await prisma.pdfFormMapping.findMany({ where });
  let mappings = rows.map(row2mapping);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    mappings = mappings.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (m.formCode && m.formCode.toLowerCase().includes(q)),
    );
  }
  return mappings;
}

export async function getPdfFormMapping(id: string): Promise<PdfFormMapping | null> {
  // Accept seed-style ids ('pdf-form-irs-w9') AND user-created ones
  // ('pdf-form-abc12345'). Block obvious path-traversal / nonsense.
  if (!/^pdf-form-[a-z0-9-]{2,64}$/.test(id)) return null;
  const row = await prisma.pdfFormMapping.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2mapping(row) : null;
}

export type CreatePdfFormMappingInput = Omit<
  PdfFormMapping,
  'id' | 'createdAt' | 'updatedAt'
>;

export async function createPdfFormMapping(
  input: CreatePdfFormMappingInput,
  ctx?: AuditContext,
): Promise<PdfFormMapping> {
  const now = new Date().toISOString();
  const id = newPdfFormMappingId();
  const m: PdfFormMapping = PdfFormMappingSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
  });
  await prisma.pdfFormMapping.create({
    data: {
      id: m.id,
      companyId: DEFAULT_COMPANY_ID,
      agency: m.agency,
      formCode: m.formCode ?? null,
      reviewed: m.reviewed,
      data: m as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Document',
    entityId: id,
    after: m,
    ctx,
  });
  return m;
}

export async function updatePdfFormMapping(
  id: string,
  patch: Partial<PdfFormMapping>,
  ctx?: AuditContext,
  auditAction: 'update' | 'approve' = 'update',
): Promise<PdfFormMapping | null> {
  const existing = await getPdfFormMapping(id);
  if (!existing) return null;
  const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...safePatch } = patch;
  const updated: PdfFormMapping = PdfFormMappingSchema.parse({
    ...existing,
    ...safePatch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await prisma.pdfFormMapping.update({
    where: { id },
    data: {
      agency: updated.agency,
      formCode: updated.formCode ?? null,
      reviewed: updated.reviewed,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Document',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
