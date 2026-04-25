// Jobs routes — Phase 1 file-backed stand-in for the future Postgres
// `Job` table. Same pattern as drafts and priced-estimates: a small
// JSON-on-disk store behind a function surface that maps 1:1 to a Prisma
// repository so the route + UI don't change when Postgres lands.

import { Router } from 'express';
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
