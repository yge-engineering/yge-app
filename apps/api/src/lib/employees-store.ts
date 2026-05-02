// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for employees.
//
// Phase 1 stand-in for the future Postgres `Employee` table. Surface area
// maps 1:1 to a Prisma repository so the routes + UI don't change when
// Postgres lands.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  EmployeeSchema,
  newEmployeeId,
  type Employee,
  type EmployeeCreate,
  type EmployeePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.EMPLOYEES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'employees')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function employeePath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Employee[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = EmployeeSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is Employee => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Employee[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createEmployee(
  input: EmployeeCreate,
  ctx?: AuditContext,
): Promise<Employee> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newEmployeeId();
  const e: Employee = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'ACTIVE',
    classification: input.classification ?? 'NOT_APPLICABLE',
    certifications: input.certifications ?? [],
    ...input,
  };
  EmployeeSchema.parse(e);
  await fs.writeFile(employeePath(id), JSON.stringify(e, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(e);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Employee',
    entityId: id,
    after: e,
    ctx,
  });
  return e;
}

export async function listEmployees(): Promise<Employee[]> {
  return readIndex();
}

export async function getEmployee(id: string): Promise<Employee | null> {
  if (!/^emp-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(employeePath(id), 'utf8');
    return EmployeeSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateEmployee(
  id: string,
  patch: EmployeePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Employee | null> {
  const existing = await getEmployee(id);
  if (!existing) return null;
  const updated: Employee = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  EmployeeSchema.parse(updated);
  await fs.writeFile(employeePath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((e) => e.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Employee',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
