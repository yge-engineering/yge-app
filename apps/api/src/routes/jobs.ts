import { Router } from 'express';
import { prisma } from '@yge/db';
import { CreateJobInputSchema } from '@yge/shared';

export const jobsRouter = Router();

// Temporary: hardcoded YGE tenant scope until auth lands.
const DEFAULT_COMPANY_ID = 'yge-root';

jobsRouter.get('/', async (_req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

jobsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CreateJobInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const job = await prisma.job.create({
      data: {
        ...parsed.data,
        companyId: DEFAULT_COMPANY_ID,
      },
    });
    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
      include: { customer: true, estimates: true },
    });
    if (!job) return res.status(404).json({ error: 'Not Found' });
    res.json({ job });
  } catch (err) {
    next(err);
  }
});
