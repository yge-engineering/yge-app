// Postgres-backed store for employees.

import { prisma } from '@yge/db';
import {
  EmployeeSchema,
  newEmployeeId,
  type Employee,
  type EmployeeCreate,
  type EmployeePatch,
  type EmploymentStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

type DbStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';

function statusToDb(s: EmploymentStatus): DbStatus {
  if (s === 'LAID_OFF') return 'TERMINATED';
  return s as DbStatus;
}

function row2emp(row: { data: unknown }): Employee | null {
  if (!row.data) return null;
  try {
    return EmployeeSchema.parse(row.data);
  } catch {
    return null;
  }
}

export async function createEmployee(
  input: EmployeeCreate,
  ctx?: AuditContext,
): Promise<Employee> {
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
  // hireDate is required by Prisma; fall back to created-now when the
  // file-store row had no hiredOn value.
  const hireDate = e.hiredOn ? new Date(e.hiredOn) : new Date(now);
  await prisma.employee.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      firstName: e.firstName,
      lastName: e.lastName,
      hireDate,
      status: statusToDb(e.status),
      classification: e.classification,
      data: e as unknown as object,
    },
  });
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
  const rows = await prisma.employee.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return rows
    .map((r) => row2emp(r))
    .filter((e): e is Employee => e !== null);
}

export async function getEmployee(id: string): Promise<Employee | null> {
  if (!/^emp-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.employee.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  if (!row) return null;
  return row2emp(row);
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
  const hireDate = updated.hiredOn ? new Date(updated.hiredOn) : new Date(existing.createdAt);
  await prisma.employee.update({
    where: { id },
    data: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      hireDate,
      status: statusToDb(updated.status),
      classification: updated.classification,
      data: updated as unknown as object,
    },
  });
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

export async function deleteEmployee(id: string, ctx?: AuditContext): Promise<boolean> {
  const existing = await getEmployee(id);
  if (!existing) return false;
  await prisma.employee.delete({ where: { id } });
  await recordAudit({
    action: 'delete',
    entityType: 'Employee',
    entityId: id,
    before: existing,
    ctx,
  });
  return true;
}
