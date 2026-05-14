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

jobsStatsRouter.get('/stats/by-year', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const byYear: Record<number, { total: number; awarded: number; lost: number }> = {};
    for (const j of jobs) {
      const yr = j.createdAt.getFullYear();
      if (!byYear[yr]) byYear[yr] = { total: 0, awarded: 0, lost: 0 };
      byYear[yr].total += 1;
      if (j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED') byYear[yr].awarded += 1;
      if (j.status === 'LOST') byYear[yr].lost += 1;
    }
    const years = Object.entries(byYear)
      .map(([yr, st]) => ({ year: Number(yr), ...st }))
      .sort((a, b) => b.year - a.year);
    res.json({ years });
  } catch (err) { next(err); }
});

jobsStatsRouter.get('/stats/awarded-revenue', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const ies = await prisma.importedEstimate.findMany({ where: { companyId, deletedAt: null } });
    const bidByJobId = new Map<string, number>();
    for (const ie of ies) {
      const d = ie.data as { jobId?: string; bidPriceCents?: number } | null;
      if (!d?.jobId || !d.bidPriceCents) continue;
      const prev = bidByJobId.get(d.jobId) ?? 0;
      if (d.bidPriceCents > prev) bidByJobId.set(d.jobId, d.bidPriceCents);
    }

    interface Year { year: number; jobs: number; revenueCents: number }
    const byYear = new Map<number, Year>();
    for (const j of jobs) {
      if (j.status !== 'AWARDED' && j.status !== 'ACTIVE' && j.status !== 'CLOSED') continue;
      const yr = j.createdAt.getFullYear();
      let st = byYear.get(yr);
      if (!st) { st = { year: yr, jobs: 0, revenueCents: 0 }; byYear.set(yr, st); }
      st.jobs += 1;
      st.revenueCents += bidByJobId.get(j.id) ?? 0;
    }
    const years = [...byYear.values()].sort((a, b) => b.year - a.year);
    res.json({ years });
  } catch (err) { next(err); }
});

