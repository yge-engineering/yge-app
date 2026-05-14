// Admin: recent audit entries — last 50, newest first.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const adminAuditSummaryRouter = Router();

adminAuditSummaryRouter.get('/recent', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const audits = await (prisma as unknown as { audit?: { findMany: (args: unknown) => Promise<unknown[]> } }).audit?.findMany?.({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }) ?? [];
    res.json({ audits });
  } catch (err) { next(err); }
});
