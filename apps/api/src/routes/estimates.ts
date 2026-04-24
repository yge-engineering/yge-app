import { Router } from 'express';
import { prisma } from '@yge/db';

export const estimatesRouter = Router();

const DEFAULT_COMPANY_ID = 'yge-root';

estimatesRouter.get('/', async (req, res, next) => {
  try {
    const { jobId } = req.query;
    const estimates = await prisma.estimate.findMany({
      where: {
        companyId: DEFAULT_COMPANY_ID,
        deletedAt: null,
        ...(typeof jobId === 'string' ? { jobId } : {}),
      },
      include: {
        job: { include: { customer: true } },
        bidItems: { include: { costLines: true }, orderBy: { itemNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ estimates });
  } catch (err) {
    next(err);
  }
});

estimatesRouter.get('/:id', async (req, res, next) => {
  try {
    const estimate = await prisma.estimate.findFirst({
      where: { id: req.params.id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
      include: {
        job: { include: { customer: true } },
        bidItems: { include: { costLines: true }, orderBy: { itemNumber: 'asc' } },
      },
    });
    if (!estimate) return res.status(404).json({ error: 'Not Found' });
    res.json({ estimate });
  } catch (err) {
    next(err);
  }
});
