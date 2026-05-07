// Postgres-backed store for portal users.
//
// JSON `data` column on the PortalUser model holds the full Zod
// shape; companyId + email are unique together. Seeded with Brook +
// Ryan on first read so the app boots usefully even before anyone
// visits /admin/portal-users.

import { prisma } from '@yge/db';
import {
  PortalUserSchema,
  newPortalUserId,
  type PortalUser,
  type PortalUserCreate,
  type PortalUserPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2user(row: { data: unknown }): PortalUser {
  return PortalUserSchema.parse(row.data);
}

async function ensureSeed(): Promise<void> {
  const count = await prisma.portalUser.count({
    where: { companyId: DEFAULT_COMPANY_ID },
  });
  if (count > 0) return;
  const now = new Date().toISOString();
  const seeds: PortalUser[] = [
    {
      id: 'pu-brook',
      createdAt: now,
      updatedAt: now,
      email: 'brookyoung@youngge.com',
      name: 'Brook L Young',
      role: 'PRESIDENT',
      assignedJobIds: [],
      hasPassword: false,
      disabled: false,
    },
    {
      id: 'pu-ryan',
      createdAt: now,
      updatedAt: now,
      email: 'ryoung@youngge.com',
      name: 'Ryan D Young',
      role: 'VP',
      assignedJobIds: [],
      hasPassword: false,
      disabled: false,
    },
  ];
  for (const u of seeds) {
    await prisma.portalUser.create({
      data: {
        id: u.id,
        companyId: DEFAULT_COMPANY_ID,
        email: u.email.toLowerCase(),
        data: u as unknown as object,
      },
    });
  }
}

export async function listPortalUsers(): Promise<PortalUser[]> {
  await ensureSeed();
  const rows = await prisma.portalUser.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2user);
}

export async function getPortalUserByEmail(
  email: string,
): Promise<PortalUser | null> {
  await ensureSeed();
  const norm = email.trim().toLowerCase();
  const row = await prisma.portalUser.findFirst({
    where: {
      companyId: DEFAULT_COMPANY_ID,
      email: norm,
      deletedAt: null,
    },
  });
  return row ? row2user(row) : null;
}

export async function getPortalUser(id: string): Promise<PortalUser | null> {
  const row = await prisma.portalUser.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2user(row) : null;
}

export async function createPortalUser(
  input: PortalUserCreate,
  ctx?: AuditContext,
): Promise<PortalUser> {
  const norm = input.email.trim().toLowerCase();
  const existing = await getPortalUserByEmail(norm);
  if (existing) {
    throw new Error(`A portal user with email ${norm} already exists.`);
  }
  const now = new Date().toISOString();
  const next: PortalUser = PortalUserSchema.parse({
    id: newPortalUserId(),
    createdAt: now,
    updatedAt: now,
    email: norm,
    name: input.name,
    role: input.role,
    employeeId: input.employeeId,
    assignedJobIds: input.assignedJobIds ?? [],
    hasPassword: false,
    disabled: input.disabled ?? false,
    notes: input.notes,
  });
  await prisma.portalUser.create({
    data: {
      id: next.id,
      companyId: DEFAULT_COMPANY_ID,
      email: norm,
      data: next as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'PortalUser',
    entityId: next.id,
    after: next,
    ctx,
  });
  return next;
}

export async function updatePortalUser(
  id: string,
  patch: PortalUserPatch,
  ctx?: AuditContext,
): Promise<PortalUser | null> {
  const before = await getPortalUser(id);
  if (!before) return null;
  const merged: PortalUser = {
    ...before,
    ...patch,
    id: before.id,
    createdAt: before.createdAt,
    updatedAt: new Date().toISOString(),
    assignedJobIds: patch.assignedJobIds ?? before.assignedJobIds,
    role: patch.role ?? before.role,
    name: patch.name ?? before.name,
    email: patch.email ? patch.email.trim().toLowerCase() : before.email,
    hasPassword: before.hasPassword,
    disabled: patch.disabled ?? before.disabled,
  };
  const validated = PortalUserSchema.parse(merged);
  await prisma.portalUser.update({
    where: { id },
    data: {
      email: validated.email.toLowerCase(),
      data: validated as unknown as object,
    },
  });
  await recordAudit({
    action: 'update',
    entityType: 'PortalUser',
    entityId: id,
    before,
    after: validated,
    ctx,
  });
  return validated;
}

export async function deletePortalUser(
  id: string,
  ctx?: AuditContext,
): Promise<boolean> {
  const before = await getPortalUser(id);
  if (!before) return false;
  // Refuse to delete the last admin (PRESIDENT or VP) — would lock
  // out portal management.
  const all = await listPortalUsers();
  const owners = all.filter(
    (u) => u.role === 'PRESIDENT' || u.role === 'VP',
  );
  if (
    owners.length === 1 &&
    (before.role === 'PRESIDENT' || before.role === 'VP')
  ) {
    throw new Error('Refusing to delete the last PRESIDENT/VP portal user.');
  }
  await prisma.portalUser.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit({
    action: 'delete',
    entityType: 'PortalUser',
    entityId: id,
    before,
    ctx,
  });
  return true;
}

/** Flip hasPassword + lastLoginAt on sign-in. Not exposed via the
 *  public routes since users update their own state implicitly. */
export async function recordPortalUserLogin(email: string): Promise<void> {
  const norm = email.trim().toLowerCase();
  const before = await getPortalUserByEmail(norm);
  if (!before) return;
  const next = {
    ...before,
    hasPassword: true,
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await prisma.portalUser.update({
    where: { id: before.id },
    data: { data: next as unknown as object },
  });
}
