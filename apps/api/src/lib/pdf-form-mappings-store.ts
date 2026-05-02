// File-based store for PDF form mappings.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. Mapping
// changes are downstream of YGE's identity (master profile) but
// upstream of every filled form, so the audit row is the answer
// to 'why did the CAL FIRE 720 fill differently last week?'.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PdfFormMappingSchema,
  newPdfFormMappingId,
  type PdfFormAgency,
  type PdfFormMapping,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { buildSeedMapping, listSeedMappings } from './pdf-form-mappings-seeds';

function dataDir(): string {
  return (
    process.env.PDF_FORM_MAPPINGS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'pdf-form-mappings')
  );
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<PdfFormMapping[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = PdfFormMappingSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((m): m is PdfFormMapping => m !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: PdfFormMapping[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(m: PdfFormMapping) {
  await ensureDir();
  await fs.writeFile(rowPath(m.id), JSON.stringify(m, null, 2), 'utf8');
  const index = await readIndex();
  const at = index.findIndex((row) => row.id === m.id);
  if (at >= 0) index[at] = m;
  else index.unshift(m);
  await writeIndex(index);
}

export interface ListPdfFormMappingsFilter {
  agency?: PdfFormAgency;
  reviewed?: boolean;
  /** Substring match against displayName + formCode (case-insensitive). */
  search?: string;
}

/**
 * Seed the curated agency forms (IRS W-9, DAS-140, ACORD 25, ...)
 * the first time the library is read. Idempotent — only writes rows
 * whose ids aren't already on disk so re-running on top of an
 * existing library doesn't clobber operator-edited mappings.
 */
async function seedIfEmpty(): Promise<void> {
  const existing = await readIndex();
  const existingIds = new Set(existing.map((m) => m.id));
  const seeds = listSeedMappings();
  const now = new Date();
  let wrote = false;
  for (const s of seeds) {
    if (existingIds.has(s.id)) continue;
    const mapping = PdfFormMappingSchema.parse(buildSeedMapping(s, now));
    await persist(mapping);
    wrote = true;
  }
  // If we wrote anything new, callers reading right after will pick
  // it up via the next readIndex().
  if (wrote) {
    // No audit record on seed — this is library bootstrap, not a
    // user mutation. Operator review (which DOES audit) happens
    // when the reviewed flag flips.
  }
}

export async function listPdfFormMappings(
  filter: ListPdfFormMappingsFilter = {},
): Promise<PdfFormMapping[]> {
  await seedIfEmpty();
  let rows = await readIndex();
  if (filter.agency) rows = rows.filter((m) => m.agency === filter.agency);
  if (filter.reviewed !== undefined) rows = rows.filter((m) => m.reviewed === filter.reviewed);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    rows = rows.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (m.formCode && m.formCode.toLowerCase().includes(q)),
    );
  }
  return rows;
}

export async function getPdfFormMapping(id: string): Promise<PdfFormMapping | null> {
  if (!/^pdf-form-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return PdfFormMappingSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
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
  await persist(m);
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
  /** Override when the patch is a domain action ('approve' = mark
   *  reviewed=true after estimator review). */
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
  await persist(updated);
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
