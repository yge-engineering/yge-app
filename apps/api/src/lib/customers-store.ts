// Postgres-backed store for customers.

import { prisma } from '@yge/db';
import {
  CustomerSchema,
  newCustomerId,
  type Customer,
  type CustomerCreate,
  type CustomerKind,
  type CustomerPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

type DbCustomerType = 'PUBLIC_AGENCY' | 'PRIVATE' | 'UTILITY' | 'OTHER';

function kindToType(kind: CustomerKind): DbCustomerType {
  switch (kind) {
    case 'STATE_AGENCY':
    case 'FEDERAL_AGENCY':
    case 'COUNTY':
    case 'CITY':
    case 'SPECIAL_DISTRICT':
      return 'PUBLIC_AGENCY';
    case 'PRIVATE_OWNER':
    case 'PRIME_CONTRACTOR':
      return 'PRIVATE';
    default:
      return 'OTHER';
  }
}

function row2cus(row: { data: unknown }): Customer | null {
  if (!row.data) return null;
  try {
    return CustomerSchema.parse(row.data);
  } catch {
    return null;
  }
}

export async function createCustomer(
  input: CustomerCreate,
  ctx?: AuditContext,
): Promise<Customer> {
  const now = new Date().toISOString();
  const id = newCustomerId();
  const c: Customer = {
    id,
    createdAt: now,
    updatedAt: now,
    taxExempt: input.taxExempt ?? false,
    onHold: input.onHold ?? false,
    ...input,
  };
  CustomerSchema.parse(c);
  await prisma.customer.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      name: c.legalName,
      type: kindToType(c.kind),
      contactName: c.contactName ?? null,
      contactEmail: c.email ?? null,
      contactPhone: c.phone ?? null,
      addressLine: c.billingAddressLine ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      zip: c.zip ?? null,
      data: c as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Customer',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCustomers(filter?: { kind?: string }): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  let all = rows
    .map((r) => row2cus(r))
    .filter((c): c is Customer => c !== null);
  if (filter?.kind) all = all.filter((c) => c.kind === filter.kind);
  all.sort((a, b) => a.legalName.localeCompare(b.legalName));
  return all;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  if (!/^cus-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.customer.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2cus(row);
}

export async function updateCustomer(
  id: string,
  patch: CustomerPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Customer | null> {
  const existing = await getCustomer(id);
  if (!existing) return null;
  const updated: Customer = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CustomerSchema.parse(updated);
  await prisma.customer.update({
    where: { id },
    data: {
      name: updated.legalName,
      type: kindToType(updated.kind),
      contactName: updated.contactName ?? null,
      contactEmail: updated.email ?? null,
      contactPhone: updated.phone ?? null,
      addressLine: updated.billingAddressLine ?? null,
      city: updated.city ?? null,
      state: updated.state ?? null,
      zip: updated.zip ?? null,
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Customer',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
