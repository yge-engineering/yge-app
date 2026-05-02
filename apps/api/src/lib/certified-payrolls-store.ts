// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for certified payroll records.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CertifiedPayrollSchema,
  newCertifiedPayrollId,
  type CertifiedPayroll,
  type CertifiedPayrollCreate,
  type CertifiedPayrollPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.CERTIFIED_PAYROLLS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'certified-payrolls')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<CertifiedPayroll[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = CertifiedPayrollSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((c): c is CertifiedPayroll => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: CertifiedPayroll[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createCertifiedPayroll(
  input: CertifiedPayrollCreate,
  ctx?: AuditContext,
): Promise<CertifiedPayroll> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newCertifiedPayrollId();
  const c: CertifiedPayroll = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    rows: input.rows ?? [],
    payrollNumber: input.payrollNumber ?? 1,
    isFinalPayroll: input.isFinalPayroll ?? false,
    complianceStatementSigned: input.complianceStatementSigned ?? false,
    ...input,
  };
  CertifiedPayrollSchema.parse(c);
  await fs.writeFile(rowPath(id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(c);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'CertifiedPayroll',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCertifiedPayrolls(filter?: {
  jobId?: string;
  status?: string;
}): Promise<CertifiedPayroll[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((c) => c.jobId === filter.jobId);
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  all.sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
  return all;
}

export async function getCertifiedPayroll(id: string): Promise<CertifiedPayroll | null> {
  if (!/^cpr-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return CertifiedPayrollSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateCertifiedPayroll(
  id: string,
  patch: CertifiedPayrollPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'sign' | 'submit' = 'update',
): Promise<CertifiedPayroll | null> {
  const existing = await getCertifiedPayroll(id);
  if (!existing) return null;
  const updated: CertifiedPayroll = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CertifiedPayrollSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'CertifiedPayroll',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
