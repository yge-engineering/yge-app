// Postgres-backed store for jobs.

import { prisma } from '@yge/db';
import { randomBytes } from 'node:crypto';
import {
  JobSchema,
  type Job,
  type JobCreate,
  type JobPatch,
  type JobStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

type DbJobStatus = 'BIDDING' | 'AWARDED' | 'ACTIVE' | 'ON_HOLD' | 'CLOSED' | 'LOST';

function statusToDb(s: JobStatus): DbJobStatus {
  switch (s) {
    case 'PROSPECT':
    case 'PURSUING':
    case 'BID_SUBMITTED':
      return 'BIDDING';
    case 'AWARDED':
      return 'AWARDED';
    case 'LOST':
    case 'NO_BID':
      return 'LOST';
    case 'ARCHIVED':
      return 'CLOSED';
    default:
      return 'BIDDING';
  }
}

function row2job(row: { data: unknown }): Job | null {
  if (!row.data) return null;
  const r = JobSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function makeId(projectName: string, when: Date): string {
  const date = when.toISOString().slice(0, 10);
  const slug = slugify(projectName) || 'job';
  const rand = randomBytes(4).toString('hex');
  return `job-${date}-${slug}-${rand}`;
}

/** Deterministic jobNumber from the file-store id (uniqueness lives
 *  on the [companyId, jobNumber] index in Prisma). The trailing 8
 *  hex chars from `makeId` work as a stable, human-friendly job
 *  number for now; the operator can rename via the UI. */
function jobNumberOf(id: string): string {
  const m = id.match(/-([a-f0-9]{8})$/);
  return m ? m[1]! : id.slice(-8);
}

export async function createJob(
  input: JobCreate,
  ctx?: AuditContext,
): Promise<Job> {
  const now = new Date();
  const iso = now.toISOString();
  const id = makeId(input.projectName, now);
  const job: Job = {
    id,
    createdAt: iso,
    updatedAt: iso,
    status: input.status ?? 'PURSUING',
    ...input,
  };
  JobSchema.parse(job);
  await prisma.job.create({
    data: {
      id,
      companyId: companyId(),
      customerId: null,
      jobNumber: jobNumberOf(id),
      name: job.projectName,
      status: statusToDb(job.status),
      data: job as unknown as object,
    },
  });
  await recordAudit({
    action: 'create',
    entityType: 'Job',
    entityId: id,
    after: job,
    ctx,
  });
  return job;
}

export async function listJobs(): Promise<Job[]> {
  const rows = await prisma.job.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2job).filter((j): j is Job => j !== null);
}

export async function getJob(id: string): Promise<Job | null> {
  if (!/^job-[a-z0-9-]{10,80}$/.test(id)) return null;
  const row = await prisma.job.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  if (!row) return null;
  return row2job(row);
}

export async function updateJob(
  id: string,
  patch: JobPatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Job | null> {
  const existing = await getJob(id);
  if (!existing) return null;
  const updated: Job = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  JobSchema.parse(updated);
  await prisma.job.update({
    where: { id },
    data: {
      name: updated.projectName,
      status: statusToDb(updated.status),
      data: updated as unknown as object,
    },
  });
  await recordAudit({
    action: auditAction,
    entityType: 'Job',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
