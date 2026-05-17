// Postgres-backed store for the labor rate book.
//
// One row per (companyId, code, effectiveFrom) — schema enforces that
// composite key. To version a rate, you write a new row with a later
// effectiveFrom and (optionally) close the previous one by setting
// its effectiveTo.
//
// Soft delete only (deletedAt) — labor rates are historical
// references and must survive audit reviews. Hard delete would orphan
// CostLine.laborRateId foreign keys on past estimates.

import { prisma } from '@yge/db';
import type { Prisma } from '@yge/db';
import {
  LaborRateSchema,
  type LaborRate,
  type LaborRateCreate,
  type LaborRatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

interface DbLaborRate {
  id: string;
  code: string;
  classification: string;
  area: number | null;
  burdenPct: Prisma.Decimal;
  baseCentsPrivate: number;
  baseCentsPW: number;
  baseCentsDB: number;
  baseCentsIBEW: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function toApi(row: DbLaborRate): LaborRate {
  // burdenPct comes back as a Prisma Decimal — convert to a JS number.
  const burdenPct =
    typeof row.burdenPct === 'object' && 'toNumber' in row.burdenPct
      ? row.burdenPct.toNumber()
      : Number(row.burdenPct);
  return LaborRateSchema.parse({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    code: row.code,
    classification: row.classification,
    area: row.area,
    burdenPct,
    baseCentsPrivate: row.baseCentsPrivate,
    baseCentsPW: row.baseCentsPW,
    baseCentsDB: row.baseCentsDB,
    baseCentsIBEW: row.baseCentsIBEW,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null,
    source: row.source,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  });
}

export interface ListOptions {
  /** ISO date string. Return only rates active on that day. */
  activeOn?: string;
  /** When true, include soft-deleted rates. Default false. */
  includeDeleted?: boolean;
}

export async function listLaborRates(opts: ListOptions = {}): Promise<LaborRate[]> {
  const where: Record<string, unknown> = { companyId: DEFAULT_COMPANY_ID };
  if (!opts.includeDeleted) where.deletedAt = null;
  if (opts.activeOn) {
    const date = new Date(opts.activeOn);
    where.effectiveFrom = { lte: date };
    where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: date } }];
  }
  const rows = await prisma.laborRate.findMany({
    where: where as never,
    orderBy: [{ classification: 'asc' }, { effectiveFrom: 'desc' }],
  });
  return rows.map(toApi);
}

export async function getLaborRate(id: string): Promise<LaborRate | null> {
  const row = await prisma.laborRate.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID },
  });
  return row ? toApi(row) : null;
}

export async function createLaborRate(
  input: LaborRateCreate,
  ctx?: AuditContext,
): Promise<LaborRate> {
  const created = await prisma.laborRate.create({
    data: {
      companyId: DEFAULT_COMPANY_ID,
      code: input.code,
      classification: input.classification,
      area: input.area ?? null,
      burdenPct: input.burdenPct as never, // Prisma accepts number → Decimal
      baseCentsPrivate: input.baseCentsPrivate,
      baseCentsPW: input.baseCentsPW,
      baseCentsDB: input.baseCentsDB,
      baseCentsIBEW: input.baseCentsIBEW ?? null,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      source: input.source ?? null,
    },
  });
  const api = toApi(created);
  await recordAudit({
    action: 'create',
    entityType: 'LaborRate',
    entityId: api.id,
    before: null,
    after: api,
    ctx,
  });
  return api;
}

export async function updateLaborRate(
  id: string,
  patch: LaborRatePatch,
  ctx?: AuditContext,
): Promise<LaborRate | null> {
  const existing = await prisma.laborRate.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID },
  });
  if (!existing) return null;
  const before = toApi(existing);

  const data: Record<string, unknown> = {};
  if (patch.code !== undefined) data.code = patch.code;
  if (patch.classification !== undefined) data.classification = patch.classification;
  if (patch.area !== undefined) data.area = patch.area;
  if (patch.burdenPct !== undefined) data.burdenPct = patch.burdenPct;
  if (patch.baseCentsPrivate !== undefined) data.baseCentsPrivate = patch.baseCentsPrivate;
  if (patch.baseCentsPW !== undefined) data.baseCentsPW = patch.baseCentsPW;
  if (patch.baseCentsDB !== undefined) data.baseCentsDB = patch.baseCentsDB;
  if (patch.baseCentsIBEW !== undefined) data.baseCentsIBEW = patch.baseCentsIBEW;
  if (patch.effectiveFrom !== undefined) data.effectiveFrom = new Date(patch.effectiveFrom);
  if (patch.effectiveTo !== undefined)
    data.effectiveTo = patch.effectiveTo ? new Date(patch.effectiveTo) : null;
  if (patch.source !== undefined) data.source = patch.source;

  const updated = await prisma.laborRate.update({
    where: { id },
    data: data as never,
  });
  const after = toApi(updated);
  await recordAudit({
    action: 'update',
    entityType: 'LaborRate',
    entityId: id,
    before,
    after,
    ctx,
  });
  return after;
}

export async function deleteLaborRate(
  id: string,
  ctx?: AuditContext,
): Promise<boolean> {
  const existing = await prisma.laborRate.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!existing) return false;
  const before = toApi(existing);
  await prisma.laborRate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    action: 'delete',
    entityType: 'LaborRate',
    entityId: id,
    before,
    after: null,
    ctx,
  });
  return true;
}
