// Aggregator endpoint: collapses 6 separate dashboard fetches into one.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const dashboardSummaryRouter = Router();

dashboardSummaryRouter.get('/summary', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const [
      customers, vendors, jobs, ies, costCodes, materials,
      bidResults, dailyReports,
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId, deletedAt: null } }),
      prisma.vendor.count({ where: { companyId, deletedAt: null } }),
      prisma.job.findMany({ where: { companyId, deletedAt: null } }),
      prisma.importedEstimate.count({ where: { companyId, deletedAt: null } }),
      prisma.costCode.count({ where: { companyId, deletedAt: null } }),
      prisma.material.count({ where: { companyId, deletedAt: null } }),
      prisma.bidResult.findMany({ where: { companyId, deletedAt: null } }),
      prisma.dailyReport.count({ where: { companyId, deletedAt: null } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;

    let won = 0, lost = 0;
    for (const r of bidResults) {
      const d = r.data as { outcome?: string } | null;
      if (d?.outcome === 'WON_BY_YGE') won += 1;
      else if (d?.outcome === 'WON_BY_OTHER') lost += 1;
    }
    const decided = won + lost;
    const winRate = decided > 0 ? won / decided : 0;

    res.json({
      counts: {
        customers, vendors, jobs: jobs.length, importedEstimates: ies,
        costCodes, materials, bidResults: bidResults.length, dailyReports,
      },
      jobsByStatus: byStatus,
      bids: { total: bidResults.length, won, lost, winRate },
    });
  } catch (err) { next(err); }
});
