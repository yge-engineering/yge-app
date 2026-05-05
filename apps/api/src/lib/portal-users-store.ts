// File-based store for portal users (people who can sign in to YGE).
//
// Plain English: a JSON file on the persistent disk. Same pattern as
// employees / ap-invoices. Seeded with Brook + Ryan on first read so
// the app boots usefully even before anyone visits the admin page.
//
// Every mutation records an audit event — CLAUDE.md mandates "every
// mutation is audit-logged".

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PortalUserSchema,
  newPortalUserId,
  type PortalUser,
  type PortalUserCreate,
  type PortalUserPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.PORTAL_USERS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'portal-users')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function seed(): PortalUser[] {
  const now = new Date().toISOString();
  return [
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
}

async function readAll(): Promise<PortalUser[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = PortalUserSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((u): u is PortalUser => u !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Seed on first read.
      const seeded = seed();
      await ensureDir();
      await fs.writeFile(indexPath(), JSON.stringify(seeded, null, 2), 'utf8');
      return seeded;
    }
    throw err;
  }
}

async function writeAll(entries: PortalUser[]) {
  await ensureDir();
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function listPortalUsers(): Promise<PortalUser[]> {
  return readAll();
}

export async function getPortalUserByEmail(
  email: string,
): Promise<PortalUser | null> {
  const norm = email.trim().toLowerCase();
  const all = await readAll();
  return all.find((u) => u.email.toLowerCase() === norm) ?? null;
}

export async function getPortalUser(id: string): Promise<PortalUser | null> {
  const all = await readAll();
  return all.find((u) => u.id === id) ?? null;
}

export async function createPortalUser(
  input: PortalUserCreate,
  ctx?: AuditContext,
): Promise<PortalUser> {
  const all = await readAll();
  const norm = input.email.trim().toLowerCase();
  if (all.some((u) => u.email.toLowerCase() === norm)) {
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
  all.unshift(next);
  await writeAll(all);
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
  const all = await readAll();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  const before = all[idx]!;
  const merged: PortalUser = {
    ...before,
    ...patch,
    id: before.id,
    createdAt: before.createdAt,
    updatedAt: new Date().toISOString(),
    // Defensive: never let a PATCH null these out.
    assignedJobIds: patch.assignedJobIds ?? before.assignedJobIds,
    role: patch.role ?? before.role,
    name: patch.name ?? before.name,
    email: patch.email ? patch.email.trim().toLowerCase() : before.email,
    hasPassword: before.hasPassword,
    disabled: patch.disabled ?? before.disabled,
  };
  const validated = PortalUserSchema.parse(merged);
  all[idx] = validated;
  await writeAll(all);
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
  const all = await readAll();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) return false;
  const before = all[idx]!;
  // Refuse to delete the last admin (PRESIDENT or VP) — would lock
  // out portal management. The caller can still demote then delete
  // but they have to do it explicitly.
  const owners = all.filter(
    (u) => u.role === 'PRESIDENT' || u.role === 'VP',
  );
  if (
    owners.length === 1 &&
    (before.role === 'PRESIDENT' || before.role === 'VP')
  ) {
    throw new Error('Refusing to delete the last PRESIDENT/VP portal user.');
  }
  all.splice(idx, 1);
  await writeAll(all);
  await recordAudit({
    action: 'delete',
    entityType: 'PortalUser',
    entityId: id,
    before,
    ctx,
  });
  return true;
}

/** Internal helper for the credentials endpoint to flip hasPassword
 *  + lastLoginAt when the user signs in. Not exposed via the public
 *  routes since users update their own state implicitly. */
export async function recordPortalUserLogin(email: string): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx < 0) return;
  const next = {
    ...all[idx]!,
    hasPassword: true,
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
}
