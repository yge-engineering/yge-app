// Imported daily reports — list endpoint that returns the raw rows
// (with data.lines[]) from the Excel "Daily Report" sheet import.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const importedDailyReportsRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

importedDailyReportsRouter.get('/', async (req, res, next) => {
  try {
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
    const co = companyId();
    const rows = await prisma.dailyReport.findMany({
      where: { companyId: co, deletedAt: null, ...(jobId ? { jobId } : {}) },
      orderBy: { reportDate: 'desc' },
    });
    const imported = rows.filter((r) => {
      const d = r.data as { importedFromExcel?: boolean } | null;
      return d?.importedFromExcel === true;
    });
    res.json({
      reports: imported.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        reportDate: r.reportDate,
        data: r.data,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});
