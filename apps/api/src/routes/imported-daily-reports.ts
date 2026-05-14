// Imported daily reports — list endpoint that returns the raw rows
// (with data.lines[]) from the Excel "Daily Report" sheet import.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { randomUUID } from 'crypto';

export const importedDailyReportsRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

importedDailyReportsRouter.get('/range', async (req, res, next) => {
  try {
    const co = companyId();
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;

    const where: { companyId: string; deletedAt: null; reportDate?: { gte?: string; lte?: string }; jobId?: string } = {
      companyId: co,
      deletedAt: null,
    };
    if (from || to) {
      where.reportDate = {};
      if (from) where.reportDate.gte = from;
      if (to) where.reportDate.lte = to;
    }
    if (jobId) where.jobId = jobId;

    const reports = await prisma.dailyReport.findMany({ where, orderBy: { reportDate: 'desc' } });
    const totalLines = reports.reduce((sum, r) => {
      const d = r.data as { lines?: unknown[] } | null;
      return sum + (d?.lines?.length ?? 0);
    }, 0);
    const totalCents = reports.reduce((sum, r) => {
      const d = r.data as { lines?: Array<{ totalCostCents?: number | null }> } | null;
      for (const ln of d?.lines ?? []) sum += ln.totalCostCents ?? 0;
      return sum;
    }, 0);

    res.json({
      from, to, jobId: jobId ?? null,
      reports: reports.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        reportDate: r.reportDate,
        lineCount: (r.data as { lines?: unknown[] } | null)?.lines?.length ?? 0,
      })),
      totalReports: reports.length,
      totalLines,
      totalCents,
    });
  } catch (err) { next(err); }
});

importedDailyReportsRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const co = companyId();
    const rows = await prisma.dailyReport.findMany({
      where: { companyId: co, deletedAt: null },
      orderBy: { reportDate: 'desc' },
    });
    const jobIds = [...new Set(rows.map((r) => r.jobId))];
    const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } } });
    const jobByid = new Map(jobs.map((j) => [j.id, j]));

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }
    const lines: string[] = [];
    lines.push('date,jobNumber,jobName,category,costCode,description,qtyHrs,unit,rate,totalCost,employeeVendor,notes');
    for (const r of rows) {
      const job = jobByid.get(r.jobId);
      const d = r.data as { lines?: Array<{ category?: string | null; costCode?: string | null; description?: string | null; qtyHrs?: number | null; unit?: string | null; rateCents?: number | null; totalCostCents?: number | null; employeeVendor?: string | null; notes?: string | null }> } | null;
      for (const ln of d?.lines ?? []) {
        lines.push([
          esc(r.reportDate),
          esc(job?.jobNumber ?? ''),
          esc(job?.name ?? ''),
          esc(ln.category ?? ''),
          esc(ln.costCode ?? ''),
          esc(ln.description ?? ''),
          esc(ln.qtyHrs ?? ''),
          esc(ln.unit ?? ''),
          esc(((ln.rateCents ?? 0) / 100).toFixed(2)),
          esc(((ln.totalCostCents ?? 0) / 100).toFixed(2)),
          esc(ln.employeeVendor ?? ''),
          esc(ln.notes ?? ''),
        ].join(','));
      }
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="daily-reports-all.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

importedDailyReportsRouter.get('/today', async (_req, res, next) => {
  try {
    const co = companyId();
    const today = new Date().toISOString().slice(0, 10);
    const rows = await prisma.dailyReport.findMany({
      where: { companyId: co, reportDate: today, deletedAt: null },
    });
    const jobIds = [...new Set(rows.map((r) => r.jobId))];
    const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } } });
    const jobName = new Map(jobs.map((j) => [j.id, { jobNumber: j.jobNumber, name: j.name }]));

    interface Line {
      reportId: string;
      jobId: string;
      jobNumber: string;
      jobName: string;
      category: string | null;
      costCode: string | null;
      description: string | null;
      qtyHrs: number | null;
      unit: string | null;
      totalCostCents: number | null;
      employeeVendor: string | null;
      createdAt: string;
    }
    const lines: Line[] = [];
    for (const r of rows) {
      const d = r.data as { lines?: Array<Record<string, unknown>> } | null;
      const j = jobName.get(r.jobId) ?? { jobNumber: '—', name: '—' };
      for (const ln of d?.lines ?? []) {
        lines.push({
          reportId: r.id,
          jobId: r.jobId,
          jobNumber: j.jobNumber,
          jobName: j.name,
          category: (ln.category as string | null) ?? null,
          costCode: (ln.costCode as string | null) ?? null,
          description: (ln.description as string | null) ?? null,
          qtyHrs: typeof ln.qtyHrs === 'number' ? ln.qtyHrs : null,
          unit: (ln.unit as string | null) ?? null,
          totalCostCents: typeof ln.totalCostCents === 'number' ? ln.totalCostCents : null,
          employeeVendor: (ln.employeeVendor as string | null) ?? null,
          createdAt: r.updatedAt.toISOString(),
        });
      }
    }
    // Recent first.
    lines.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ date: today, lines });
  } catch (err) { next(err); }
});

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
