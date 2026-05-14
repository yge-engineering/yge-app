// GET /api/jobs/:id/cost-code-variance — per-cost-code bid vs actual.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const jobsCostCodeVarianceRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

interface VarianceRow {
  costCode: string;
  description: string;
  category: string;
  bidQty: number;
  bidTotalCents: number;
  actualQty: number;
  actualTotalCents: number;
  varianceCents: number;
}

interface ImportedLine {
  costCode?: string;
  category?: string;
  description?: string;
  quantity?: number;
  totalCostCents?: number;
}

interface ReportLine {
  costCode?: string | null;
  category?: string | null;
  description?: string | null;
  qtyHrs?: number | null;
  totalCostCents?: number | null;
}

jobsCostCodeVarianceRouter.get('/:id/cost-code-variance', async (req, res, next) => {
  try {
    const co = companyId();
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, companyId: co, deletedAt: null },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const rows = new Map<string, VarianceRow>();

    function ensure(code: string, description: string, category: string): VarianceRow {
      const k = code.toUpperCase();
      let r = rows.get(k);
      if (!r) {
        r = {
          costCode: k,
          description: description || k,
          category: category || '—',
          bidQty: 0,
          bidTotalCents: 0,
          actualQty: 0,
          actualTotalCents: 0,
          varianceCents: 0,
        };
        rows.set(k, r);
      }
      return r;
    }

    // Bid side — every ImportedEstimate linked to this job.
    const ies = await prisma.importedEstimate.findMany({
      where: { companyId: co, deletedAt: null },
    });
    for (const ie of ies) {
      const d = ie.data as { jobId?: string; lines?: ImportedLine[] } | null;
      if (!d || d.jobId !== job.id) continue;
      for (const ln of d.lines ?? []) {
        const code = (ln.costCode ?? '').trim();
        if (!code) continue;
        const r = ensure(code, ln.description ?? '', ln.category ?? '');
        r.bidQty += ln.quantity ?? 0;
        r.bidTotalCents += ln.totalCostCents ?? 0;
      }
    }

    // Actual side — every DailyReport line on this job.
    const reports = await prisma.dailyReport.findMany({
      where: { companyId: co, jobId: job.id, deletedAt: null },
    });
    for (const rep of reports) {
      const d = rep.data as { lines?: ReportLine[] } | null;
      for (const ln of d?.lines ?? []) {
        const code = (ln.costCode ?? '').trim();
        if (!code) continue;
        const r = ensure(code, ln.description ?? '', ln.category ?? '');
        r.actualQty += ln.qtyHrs ?? 0;
        r.actualTotalCents += ln.totalCostCents ?? 0;
      }
    }

    // Compute variance and sort by | variance | desc to surface
    // over-budget items first.
    const final = [...rows.values()].map((r) => ({
      ...r,
      varianceCents: r.bidTotalCents - r.actualTotalCents,
    }));
    final.sort((a, b) => Math.abs(b.varianceCents) - Math.abs(a.varianceCents));

    res.json({
      jobNumber: job.jobNumber,
      jobName: job.name,
      rows: final,
    });
  } catch (err) {
    next(err);
  }
});
