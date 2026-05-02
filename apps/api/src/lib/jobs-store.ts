// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for jobs.
//
// Phase 1 stand-in for the future Postgres `Job` table. Surface area
// (createJob / listJobs / getJob / updateJob) maps 1:1 to a Prisma
// repository so the route + UI don't change when Postgres lands.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  JobSchema,
  type Job,
  type JobCreate,
  type JobPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.JOBS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'jobs');
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function jobPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
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
  const rand = randomBytes(4).toString('hex'); // 8 hex chars
  return `job-${date}-${slug}-${rand}`;
}

async function readIndex(): Promise<Job[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Schema-parse on read so newly added optional fields (e.g. status
    // defaults) backfill cleanly when reading older index files.
    return parsed
      .map((entry: unknown) => {
        const result = JobSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((j): j is Job => j !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Job[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

/** Persist a new job and return the saved record. The index doubles as
 *  the per-job storage because the Job model is small (just metadata —
 *  no bid items or sub lists). When Postgres lands we split this into
 *  a real index + per-row table. */
export async function createJob(
  input: JobCreate,
  ctx?: AuditContext,
): Promise<Job> {
  await ensureDir();
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
  // Validate before writing.
  JobSchema.parse(job);
  await fs.writeFile(jobPath(id), JSON.stringify(job, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(job);
  await writeIndex(index);
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
  return readIndex();
}

export async function getJob(id: string): Promise<Job | null> {
  // Defensive id format check — stops path-traversal attacks cold.
  if (!/^job-[a-z0-9-]{10,80}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(jobPath(id), 'utf8');
    return JobSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
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
  await fs.writeFile(jobPath(id), JSON.stringify(updated, null, 2), 'utf8');
  // Rebuild the index entry.
  const index = await readIndex();
  const idx = index.findIndex((j) => j.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
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
