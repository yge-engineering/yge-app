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
    // Record the sync timestamps so live-mode can tell when push/pull
    // is needed.
    const row = await prisma.estimate.findFirst({
      where: { id: req.params.id ?? '', deletedAt: null },
    });
    if (row) {
      const dataObj = (row.data ?? {}) as Record<string, unknown>;
      const updatedData = JSON.parse(
        JSON.stringify({
          ...dataObj,
          lastExcelSyncAt: new Date().toISOString(),
          lastSyncExcelModified: item.lastModifiedDateTime ?? null,
        }),
      );
      await prisma.estimate.update({
        where: { id: row.id },
        data: { data: updatedData },
      });
    }

    res.json({
      webUrl: item.webUrl ?? null,
      itemId: item.id,
      path: `${jobFolderPath(est.jobNumber, est.projectName)}/${fileName}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/estimates/:id/excel/pull { email } — re-read the estimate
// from its OneDrive workbook and update the app's data.
estimatesExcelRouter.post('/:id/excel/pull', async (req, res, next) => {
  try {
    const Body = z.object({ email: z.string().email() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const id = req.params.id ?? '';
    const row = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { job: true },
    });
    if (!row) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const stored = (row.data ?? {}) as { jobNumber?: string; projectName?: string };
    const jobNumber = stored.jobNumber ?? row.job.jobNumber;
    const projectName = stored.projectName ?? row.job.name;

    const { findByPath, downloadFile, jobFolderPath } = await import('../lib/onedrive');
    const path = `${jobFolderPath(jobNumber, projectName)}/Est_${jobNumber}.xlsx`;
    const item = await findByPath(parsed.data.email, path);
    if (!item) {
      return res.status(404).json({
        error: 'Workbook not found in OneDrive at that path',
        path,
        hint: 'Save the estimate to OneDrive first (use the "📁 Save to OneDrive" button).',
      });
    }

    // Smart-poll: skip the download + parse if the OneDrive file
    // hasn't been touched since this estimate was last updated. The
    // <LiveExcelSync> UI calls this every 30s; we want it to be cheap.
    const force = String((req.query.force ?? '')) === '1';
    if (!force && item.lastModifiedDateTime && row.updatedAt) {
      const fileMs = Date.parse(item.lastModifiedDateTime);
      const estMs = row.updatedAt.getTime();
      if (Number.isFinite(fileMs) && fileMs <= estMs) {
        return res.json({
          ok: true,
          skipped: true,
          reason: 'OneDrive file unchanged since last sync',
          oneDriveLastModified: item.lastModifiedDateTime,
          estimateUpdatedAt: row.updatedAt.toISOString(),
        });
      }
    }
    const { bytes } = await downloadFile(parsed.data.email, item.id);
    const { parseEstimates } = await import('../lib/excel-master-tables');
    const result = parseEstimates(Buffer.from(bytes));

    // Match by jobNumber.
    const match = result.estimates.find((e) => e.jobNumber === jobNumber);
    if (!match) {
      return res.status(422).json({
        error: 'Workbook has no Est_<jobNumber> sheet matching this job',
        expectedJobNumber: jobNumber,
        sheetsFound: result.estimates.map((e) => e.sheetName),
        warnings: result.warnings,
      });
    }

    const estimateData = JSON.parse(
      JSON.stringify({
        sheetName: match.sheetName,
        jobNumber: match.jobNumber,
        projectName: match.projectName,
        rateType: match.rateType,
        oppPercent: match.oppPercent,
        directCostCents: match.directCostCents,
        oppMarkupCents: match.oppMarkupCents,
        bidPriceCents: match.bidPriceCents,
        bidItems: match.bidItems,
        importedFromExcel: true,
        importedAt: new Date().toISOString(),
        pulledFrom: path,
      }),
    );

    // Stamp sync timestamps so the sync-status endpoint can compute
    // state. lastSyncExcelModified records THIS file revision so a
    // later push doesn't see itself as a new change.
    (estimateData as Record<string, unknown>).lastExcelSyncAt = new Date().toISOString();
    (estimateData as Record<string, unknown>).lastSyncExcelModified = item.lastModifiedDateTime ?? null;

    await prisma.estimate.update({
      where: { id: row.id },
      data: {
        oppAmountCents: BigInt(match.oppMarkupCents),
        data: estimateData,
      },
    });

    res.json({
      ok: true,
      bidItems: match.bidItems.length,
      costLines: match.bidItems.reduce((s, b) => s + b.costLines.length, 0),
      directCost: match.directCostCents / 100,
      oppMarkup: match.oppMarkupCents / 100,
      bidPrice: match.bidPriceCents / 100,
      warnings: result.warnings,
    });
  } catch (err) {
    next(err);
  }
});


// GET /api/estimates/:id/excel/sync-status?email= — compute the
// current state between the app's estimate and the OneDrive workbook.
estimatesExcelRouter.get('/:id/excel/sync-status', async (req, res, next) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!email) {
      return res.status(400).json({ error: 'Missing email query param' });
    }
    const id = req.params.id ?? '';
    const row = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { job: true },
    });
    if (!row) return res.status(404).json({ error: 'Estimate not found' });
    const stored = (row.data ?? {}) as {
      jobNumber?: string;
      projectName?: string;
      lastExcelSyncAt?: string;
      lastSyncExcelModified?: string | null;
    };
    const jobNumber = stored.jobNumber ?? row.job.jobNumber;
    const projectName = stored.projectName ?? row.job.name;
    const { findByPath, jobFolderPath } = await import('../lib/onedrive');
    const path = `${jobFolderPath(jobNumber, projectName)}/Est_${jobNumber}.xlsx`;
    const item = await findByPath(email, path);
    if (!item) {
      return res.json({ state: 'no-file', path });
    }

    const fileModMs = item.lastModifiedDateTime
      ? Date.parse(item.lastModifiedDateTime)
      : 0;
    const lastSyncMs = stored.lastExcelSyncAt
      ? Date.parse(stored.lastExcelSyncAt)
      : 0;
    const lastSyncFileMs = stored.lastSyncExcelModified
      ? Date.parse(stored.lastSyncExcelModified)
      : 0;
    const estUpdatedMs = row.updatedAt.getTime();

    // Excel newer = file modified after the recorded last-sync-file-mod.
    const excelNewer = fileModMs > lastSyncFileMs;
    // App newer = estimate updatedAt is later than the last sync timestamp.
    // Allow a small slop window for clock drift / writes within the same second.
    const appNewer = estUpdatedMs - lastSyncMs > 2000;

    let state: 'in-sync' | 'excel-newer' | 'app-newer' | 'conflict' = 'in-sync';
    if (excelNewer && appNewer) state = 'conflict';
    else if (excelNewer) state = 'excel-newer';
    else if (appNewer) state = 'app-newer';

    res.json({
      state,
      path,
      fileLastModified: item.lastModifiedDateTime ?? null,
      estimateUpdatedAt: row.updatedAt.toISOString(),
      lastExcelSyncAt: stored.lastExcelSyncAt ?? null,
      lastSyncExcelModified: stored.lastSyncExcelModified ?? null,
    });
  } catch (err) {
    next(err);
  }
});

