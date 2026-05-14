// Aggregate job stats: count per status, total bid$ open, etc.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const jobsStatsRouter = Router();

jobsStatsRouter.get('/stats', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });

    const byStatus: Record<string, number> = {};
    for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;

    const byRateType: Record<string, number> = {};
    for (const j of jobs) byRateType[j.rateType] = (byRateType[j.rateType] ?? 0) + 1;

    res.json({
      total: jobs.length,
      byStatus,
      byRateType,
    });
  } catch (err) { next(err); }
});
