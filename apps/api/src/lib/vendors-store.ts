// Postgres-backed store for vendors. JSON `data` column holds the
// full Zod-validated Vendor shape; companyId scopes per-tenant; the
// route + UI are unchanged.
//
// Every mutation records an audit event — CLAUDE.md mandates that.

import { prisma } from '@yge/db';
import {
  VendorSchema,
  newVendorId,
  type Vendor,
  type VendorCreate,
  type VendorPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'co-yge';

function row2vendor(row: { data: unknown }): Vendor {
  return VendorSchema.parse(row.data);
}

export async function createVendor(
  input: VendorCreate,
  ctx?: AuditContext,
): Promise<Vendor> {
  const now = new Date().toISOString();
  const id = newVendorId();
  const v: Vendor = {
    id,
    createdAt: now,
    updatedAt: now,
    paymentTerms: input.paymentTerms ?? 'NET_30',
    w9OnFile: input.w9OnFile ?? false,
    is1099Reportable: input.is1099Reportable ?? false,
    coiOnFile: input.coiOnFile ?? false,
    onHold: input.onHold ?? false,
    ...input,
  };
  VendorSchema.parse(v);
  await prisma.vendor.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      data: v as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Vendor',
    entityId: id,
    after: v,
    ctx,
  });
  return v;
}

export async function listVendors(filter?: { kind?: string }): Promise<Vendor[]> {
  const rows = await prisma.vendor.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  let all = rows.map(row2vendor);
  if (filter?.kind) all = all.filter((v) => v.kind === filter.kind);
  all.sort((a, b) => a.legalName.localeCompare(b.legalName));
  return all;
}

export async function getVendor(id: string): Promise<Vendor | null> {
  if (!/^vnd-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.vendor.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2vendor(row);
}

export async function updateVendor(
  id: string,
  patch: VendorPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Vendor | null> {
  const existing = await getVendor(id);
  if (!existing) return null;
  const updated: Vendor = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  VendorSchema.parse(updated);
  await prisma.vendor.update({
    where: { id },
    data: { data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Vendor',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
