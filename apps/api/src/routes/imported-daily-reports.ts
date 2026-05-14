// Imported daily reports — list endpoint that returns the raw rows
// (with data.lines[]) from the Excel "Daily Report" sheet import.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { randomUUID } from 'crypto';

export const importedDailyReportsRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

importedDailyReportsRouter.post('/quick-log', async (req, res, next) => {
  try {
    const co = companyId();
    const b = req.body as {
      jobId?: string;
      reportDate?: string;
      costCode?: string;
      description?: string;
      qtyHrs?: number;
      unit?: string;
      rateCents?: number;
      totalCostCents?: number;
      employeeVendor?: string;
      notes?: string;
      category?: string;
    };
    if (!b.jobId || !b.reportDate) {
      return res.status(400).json({ error: 'jobId and reportDate required' });
    }

    const job = await prisma.job.findFirst({
      where: { id: b.jobId, companyId: co, deletedAt: null },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Pre-compute line totals if not provided.
    const qty = Number(b.qtyHrs ?? 0);
    const rate = Number(b.rateCents ?? 0);
    const total = Number(b.totalCostCents ?? (qty * rate));

    const line = {
      date: b.reportDate,
      jobNumber: job.jobNumber,
      jobName: job.name,
      category: b.category ?? null,
      costCode: b.costCode ?? null,
      description: b.description ?? null,
      qtyHrs: Number.isFinite(qty) ? qty : null,
      unit: b.unit ?? null,
      otMult: null,
      rateCents: Number.isFinite(rate) ? rate : null,
      totalCostCents: Number.isFinite(total) ? total : null,
      employeeVendor: b.employeeVendor ?? null,
      notes: b.notes ?? null,
    };

    const existing = await prisma.dailyReport.findFirst({
      where: { companyId: co, jobId: job.id, reportDate: b.reportDate, deletedAt: null },
    });
    if (existing) {
      const d = (existing.data as { lines?: unknown[]; importedFromExcel?: boolean } | null) ?? {};
      const lines = Array.isArray(d.lines) ? d.lines : [];
      lines.push(line);
      const newData = { ...d, lines, importedFromExcel: true };
      await prisma.dailyReport.update({
        where: { id: existing.id },
        data: { data: JSON.parse(JSON.stringify(newData)) },
      });
      res.json({ ok: true, reportId: existing.id, lineCount: lines.length });
    } else {
      const id = 'dr-' + randomUUID().replace(/-/g, '').slice(0, 12);
      await prisma.dailyReport.create({
        data: {
          id,
          companyId: co,
          jobId: job.id,
          reportDate: b.reportDate,
          data: JSON.parse(JSON.stringify({ lines: [line], importedFromExcel: true })),
        },
      });
      res.json({ ok: true, reportId: id, lineCount: 1 });
    }
  } catch (err) { next(err); }
});

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
