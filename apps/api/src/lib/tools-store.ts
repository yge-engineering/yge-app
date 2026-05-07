// Postgres-backed store for hand tools / small equipment.

import { prisma } from '@yge/db';
import {
  ToolSchema,
  newToolId,
  type Tool,
  type ToolCreate,
  type ToolPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2tool(row: { data: unknown }): Tool {
  return ToolSchema.parse(row.data);
}

export async function createTool(
  input: ToolCreate,
  ctx?: AuditContext,
): Promise<Tool> {
  const now = new Date().toISOString();
  const id = newToolId();
  const t: Tool = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'IN_YARD',
    ...input,
  };
  ToolSchema.parse(t);
  await prisma.toolAsset.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      status: t.status,
      data: t as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Tool',
    entityId: id,
    after: t,
    ctx,
  });
  return t;
}

export async function listTools(): Promise<Tool[]> {
  const rows = await prisma.toolAsset.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2tool);
}

export async function getTool(id: string): Promise<Tool | null> {
  if (!/^tool-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.toolAsset.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2tool(row) : null;
}

export async function updateTool(
  id: string,
  patch: ToolPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'assign' | 'unassign' = 'update',
): Promise<Tool | null> {
  const existing = await getTool(id);
  if (!existing) return null;
  const updated: Tool = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ToolSchema.parse(updated);
  await prisma.toolAsset.update({
    where: { id },
    data: { status: updated.status, data: updated as unknown as object },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Tool',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/** Helper: assign a tool to an employee. Keeps status + assignee fields
 *  in lockstep so the UI never sees a half-state row. */
export async function assignTool(
  id: string,
  assignedToEmployeeId: string,
): Promise<Tool | null> {
  return updateTool(
    id,
    {
      status: 'ASSIGNED',
      assignedToEmployeeId,
      assignedAt: new Date().toISOString(),
    },
    undefined,
    'assign',
  );
}

/** Helper: return a tool to the yard. Clears assignee/assignedAt. */
export async function returnTool(
  id: string,
  destination: 'IN_YARD' | 'IN_SHOP' | 'OUT_FOR_REPAIR' = 'IN_YARD',
): Promise<Tool | null> {
  return updateTool(
    id,
    {
      status: destination,
      assignedToEmployeeId: undefined,
      assignedAt: undefined,
    },
    undefined,
    'unassign',
  );
}
