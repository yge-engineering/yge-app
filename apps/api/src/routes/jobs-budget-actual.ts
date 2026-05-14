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
