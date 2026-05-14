// GET /api/jobs/:id/budget-actual — Budget vs Actual for a single job.
// Budget: from Job.data (imported from the Excel Jobs sheet).
// Actual: sum of DailyReport.data.lines[].totalCostCents, normalized
// by category (Labor / Materials / Equipment / Subs / Other).

import { Router } from 'express';
import { prisma } from '@yge/db';

export const jobsBudgetActualRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

function normalizeCategory(raw: string | null | undefined): 'LABOR' | 'MATERIALS' | 'EQUIPMENT' | 'SUBS' | 'OTHER' {
  const c = (raw ?? '').toLowerCase();
  if (c.includes('labor')) return 'LABOR';
  if (c.includes('material')) return 'MATERIALS';
  if (c.includes('equip')) return 'EQUIPMENT';
  if (c.includes('sub')) return 'SUBS';
  return 'OTHER';
}

jobsBudgetActualRouter.get('/:id/budget-actual', async (req, res, next) => {
  try {
    const co = companyId();
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, companyId: co, deletedAt: null },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const jdata = (job.data ?? {}) as {
      budgetLaborCents?: number;
      budgetMaterialsCents?: number;
      budgetEquipmentCents?: number;
      budgetSubsCents?: number;
      budgetOtherCents?: number;
      totalBudgetCents?: number;
    };

    const budgets = {
      LABOR: jdata.budgetLaborCents ?? 0,
      MATERIALS: jdata.budgetMaterialsCents ?? 0,
      EQUIPMENT: jdata.budgetEquipmentCents ?? 0,
      SUBS: jdata.budgetSubsCents ?? 0,
      OTHER: jdata.budgetOtherCents ?? 0,
    } as const;

    const reports = await prisma.dailyReport.findMany({
      where: { companyId: co, jobId: job.id, deletedAt: null },
    });

    const actuals: Record<string, number> = {
      LABOR: 0,
      MATERIALS: 0,
      EQUIPMENT: 0,
      SUBS: 0,
      OTHER: 0,
    };

    for (const r of reports) {
      const d = r.data as { lines?: { category?: string | null; totalCostCents?: number | null }[] } | null;
      const lines = d?.lines ?? [];
      for (const ln of lines) {
        const key = normalizeCategory(ln.category ?? '');
        actuals[key] = (actuals[key] ?? 0) + (ln.totalCostCents ?? 0);
      }
    }

    const totalBudget = jdata.totalBudgetCents ?? Object.values(budgets).reduce((a, b) => a + b, 0);
    const totalActual = Object.values(actuals).reduce((a, b) => a + (b ?? 0), 0);
    const totalPct = totalBudget > 0 ? totalActual / totalBudget : 0;
    const status = totalPct > 1.0 ? 'Over' : totalPct > 0.85 ? 'Watch' : 'On Track';

    const categories = (['LABOR', 'MATERIALS', 'EQUIPMENT', 'SUBS', 'OTHER'] as const).map((k) => ({
      key: k,
      budget: budgets[k] ?? 0,
      actual: actuals[k] ?? 0,
      variance: (budgets[k] ?? 0) - (actuals[k] ?? 0),
      pctUsed: (budgets[k] ?? 0) > 0 ? (actuals[k] ?? 0) / (budgets[k] ?? 0) : 0,
    }));

    res.json({
      jobNumber: job.jobNumber,
      jobName: job.name,
      categories,
      total: { budget: totalBudget, actual: totalActual, pctUsed: totalPct },
      status,
    });
  } catch (err) {
    next(err);
  }
});

jobsBudgetActualRouter.get('/:id/cost-lines.csv', async (req, res, next) => {
  try {
    const co = companyId();
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, companyId: co, deletedAt: null },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const reports = await prisma.dailyReport.findMany({
      where: { companyId: co, jobId: job.id, deletedAt: null },
      orderBy: { reportDate: 'asc' },
    });

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }
    const lines: string[] = [];
    lines.push('date,category,costCode,description,qtyHrs,unit,rate,totalCost,employeeVendor,notes');
    for (const r of reports) {
      const d = r.data as { lines?: Array<{ category?: string | null; costCode?: string | null; description?: string | null; qtyHrs?: number | null; unit?: string | null; rateCents?: number | null; totalCostCents?: number | null; employeeVendor?: string | null; notes?: string | null }> } | null;
      for (const ln of d?.lines ?? []) {
        lines.push([
          esc(r.reportDate),
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
    res.setHeader('Content-Disposition', `attachment; filename="${job.jobNumber}-cost-lines.csv"`);
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

