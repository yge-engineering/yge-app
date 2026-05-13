// /api/estimates/:id/excel.xlsx + /api/estimates/:id/excel/save-to-onedrive
// — generate the YGE-format workbook from any Estimate record.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@yge/db';
import {
  buildEstimateWorkbook,
  type EstimateBidItemData,
  type EstimateWorkbookInput,
} from '../lib/excel-estimate-generator';

export const estimatesExcelRouter = Router();

interface StoredEstimateData {
  sheetName?: string;
  jobNumber?: string;
  projectName?: string;
  rateType?: string;
  oppPercent?: number;
  directCostCents?: number;
  oppMarkupCents?: number;
  bidPriceCents?: number;
  bidItems?: EstimateBidItemData[];
}

async function loadEstimate(id: string): Promise<EstimateWorkbookInput | null> {
  const row = await prisma.estimate.findFirst({
    where: { id, deletedAt: null },
    include: { job: true },
  });
  if (!row) return null;
  const stored = (row.data ?? {}) as StoredEstimateData;
  if (!stored.bidItems || stored.bidItems.length === 0) return null;
  return {
    jobNumber: stored.jobNumber ?? row.job.jobNumber,
    projectName: stored.projectName ?? row.job.name,
    rateType: stored.rateType ?? row.job.rateType ?? 'PW',
    oppPercent: stored.oppPercent ?? Number(row.oppPercent) ?? 0.2,
    directCostCents: stored.directCostCents ?? 0,
    oppMarkupCents: stored.oppMarkupCents ?? Number(row.oppAmountCents) ?? 0,
    bidPriceCents:
      stored.bidPriceCents ??
      (stored.directCostCents ?? 0) + (stored.oppMarkupCents ?? 0),
    bidItems: stored.bidItems,
  };
}

estimatesExcelRouter.get('/:id/excel.xlsx', async (req, res, next) => {
  try {
    const est = await loadEstimate(req.params.id ?? '');
    if (!est) {
      return res.status(404).json({ error: 'Estimate not found or has no bid items' });
    }
    const buf = buildEstimateWorkbook(est);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Est_${est.jobNumber}.xlsx"`,
    );
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

estimatesExcelRouter.post('/:id/excel/save-to-onedrive', async (req, res, next) => {
  try {
    const Body = z.object({ email: z.string().email() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const est = await loadEstimate(req.params.id ?? '');
    if (!est) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    const buf = buildEstimateWorkbook(est);

    const { ensureFolderPath, uploadFile, jobFolderPath } = await import('../lib/onedrive');
    const folder = await ensureFolderPath(
      parsed.data.email,
      jobFolderPath(est.jobNumber, est.projectName),
    );
    const fileName = `Est_${est.jobNumber}.xlsx`;
    const item = await uploadFile(
      parsed.data.email,
      folder.id,
      fileName,
      buf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.json({
      webUrl: item.webUrl ?? null,
      itemId: item.id,
      path: `${jobFolderPath(est.jobNumber, est.projectName)}/${fileName}`,
    });
  } catch (err) {
    next(err);
  }
});
