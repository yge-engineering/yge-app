// Jobs routes — Phase 1 file-backed stand-in for the future Postgres
// `Job` table. Same pattern as drafts and priced-estimates: a small
// JSON-on-disk store behind a function surface that maps 1:1 to a Prisma
// repository so the route + UI don't change when Postgres lands.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { JobCreateSchema, JobPatchSchema } from '@yge/shared';
import { createJob, getJob, listJobs, updateJob } from '../lib/jobs-store';

export const jobsRouter = Router();

// GET /api/jobs — newest-first list of every job.
jobsRouter.get('/', async (_req, res, next) => {
  try {
    const jobs = await listJobs();
    return res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id — full job record.
jobsRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } });

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }
    const lines: string[] = [];
    lines.push('id,jobNumber,name,status,rateType,customerId,createdAt,projectName,projectType,contractType,ownerAgency,location,bidDueDate');
    for (const j of jobs) {
      const d = (j.data as Record<string, unknown> | null) ?? {};
      lines.push([
        esc(j.id), esc(j.jobNumber), esc(j.name), esc(j.status), esc(j.rateType),
        esc(j.customerId ?? ''), esc(j.createdAt.toISOString()),
        esc((d.projectName as string) ?? j.name),
        esc((d.projectType as string) ?? ''),
        esc((d.contractType as string) ?? ''),
        esc((d.ownerAgency as string) ?? (d.client as string) ?? ''),
        esc((d.location as string) ?? ''),
        esc((d.bidDueDate as string) ?? ''),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="jobs.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs — create a new job.
jobsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = JobCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const job = await createJob(parsed.data);
    return res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/jobs/:id — partial update.
jobsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = JobPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateJob(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job: updated });
  } catch (err) {
    next(err);
  }
});
