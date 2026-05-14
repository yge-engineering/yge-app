// Imported estimates routes — list + read + create + patch + delete.
//
// Lifted out of the existing /estimates route (which is for the
// AI-drafted PricedEstimate model) so the two coexist.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { ImportedEstimateCreateSchema, ImportedEstimatePatchSchema } from '@yge/shared';
import {
  createImportedEstimate,
  deleteImportedEstimate,
  getImportedEstimate,
  listImportedEstimates,
  updateImportedEstimate,
} from '../lib/imported-estimates-store';
import { createJob } from '../lib/jobs-store';
import { buildEstimateWorkbook, type EstimateBidItemData } from '../lib/excel-estimate-generator';

function newSnapshotId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return 'snap-' + hex.padStart(8, '0');
}

export const importedEstimatesRouter = Router();

importedEstimatesRouter.get('/', async (_req, res, next) => {
  try {
    const importedEstimates = await listImportedEstimates();
    return res.json({ importedEstimates });
  } catch (err) { next(err); }
});

importedEstimatesRouter.get('/:id', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ importedEstimate: ie });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ImportedEstimateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const ie = await createImportedEstimate(parsed.data);
    return res.status(201).json({ importedEstimate: ie });
  } catch (err) { next(err); }
});

importedEstimatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ImportedEstimatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateImportedEstimate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ importedEstimate: updated });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/:id/clone', async (req, res, next) => {
  try {
    const src = await getImportedEstimate(req.params.id);
    if (!src) return res.status(404).json({ error: 'Imported estimate not found' });
    const body = req.body as {
      jobNumber?: string;
      projectName?: string;
      client?: string;
    };
    if (!body.jobNumber || !body.projectName) {
      return res.status(400).json({ error: 'jobNumber and projectName are required' });
    }
    const cloned = await createImportedEstimate({
      jobNumber: body.jobNumber,
      projectName: body.projectName,
      client: body.client ?? src.client,
      rateType: src.rateType,
      oppPercent: src.oppPercent,
      directCostCents: src.directCostCents,
      oppMarkupCents: src.oppMarkupCents,
      bidPriceCents: src.bidPriceCents,
      lines: src.lines,
      snapshots: [],
      notes: src.notes ? `Cloned from ${src.jobNumber} — ${src.projectName}\n\n${src.notes}` : `Cloned from ${src.jobNumber} — ${src.projectName}`,
    });
    res.status(201).json({ importedEstimate: cloned });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/:id/snapshot', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    const label = (req.body?.label as string | undefined)?.slice(0, 200) || `Snapshot ${new Date().toISOString().slice(0, 16)}`;
    const snap = {
      id: newSnapshotId(),
      createdAt: new Date().toISOString(),
      label,
      oppPercent: ie.oppPercent,
      directCostCents: ie.directCostCents,
      oppMarkupCents: ie.oppMarkupCents,
      bidPriceCents: ie.bidPriceCents,
      lines: ie.lines,
    };
    const updated = await updateImportedEstimate(ie.id, {
      snapshots: [...(ie.snapshots ?? []), snap],
    });
    res.status(201).json({ snapshot: snap, importedEstimate: updated });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/:id/restore/:snapshotId', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    const snap = (ie.snapshots ?? []).find((s) => s.id === req.params.snapshotId);
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    // Auto-snapshot the current state before restoring.
    const autoSnap = {
      id: newSnapshotId(),
      createdAt: new Date().toISOString(),
      label: `Auto-snapshot before restore of "${snap.label}"`,
      oppPercent: ie.oppPercent,
      directCostCents: ie.directCostCents,
      oppMarkupCents: ie.oppMarkupCents,
      bidPriceCents: ie.bidPriceCents,
      lines: ie.lines,
    };
    const updated = await updateImportedEstimate(ie.id, {
      oppPercent: snap.oppPercent,
      directCostCents: snap.directCostCents,
      oppMarkupCents: snap.oppMarkupCents,
      bidPriceCents: snap.bidPriceCents,
      lines: snap.lines,
      snapshots: [...(ie.snapshots ?? []), autoSnap],
    });
    res.json({ importedEstimate: updated, restoredFrom: snap.id, autoSnapshot: autoSnap.id });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/:id/convert-to-job', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    if (ie.jobId) return res.status(409).json({ error: 'Estimate is already linked to a job', jobId: ie.jobId });

    const job = await createJob({
      projectName: ie.projectName,
      projectType: 'OTHER',
      contractType: 'OTHER',
      status: 'PURSUING',
      ownerAgency: ie.client,
      notes: `Created from imported estimate ${ie.jobNumber} — ${ie.projectName}`,
    });

    const updated = await updateImportedEstimate(ie.id, { jobId: job.id });
    res.status(201).json({ job, importedEstimate: updated });
  } catch (err) { next(err); }
});

importedEstimatesRouter.get('/:id/excel.xlsx', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });

    // Group flat lines[] by sectionName into bidItems for the generator.
    const groups = new Map<string, EstimateBidItemData>();
    let order = 0;
    const ordering: string[] = [];
    for (const ln of ie.lines) {
      const section = ln.sectionName ?? '(Uncategorized)';
      let group = groups.get(section);
      if (!group) {
        order += 1;
        group = {
          itemNumber: String(order),
          description: section,
          costLines: [],
          subtotalDirectCents: 0,
          subtotalOppCents: 0,
          subtotalBidCents: 0,
        };
        groups.set(section, group);
        ordering.push(section);
      }
      group.costLines.push({
        category: ln.category ?? null,
        costCode: ln.costCode ?? null,
        description: ln.description,
        quantity: ln.quantity,
        unit: ln.unit ?? '',
        otMult: ln.otMultiplier,
        unitCostCents: ln.unitCostCents,
        totalCostCents: ln.totalCostCents,
        oppMarkupCents: ln.oppMarkupCents,
        bidPriceCents: ln.bidPriceCents,
        notes: ln.notes ?? null,
      });
      group.subtotalDirectCents += ln.totalCostCents;
      group.subtotalOppCents += ln.oppMarkupCents;
      group.subtotalBidCents += ln.bidPriceCents;
    }
    const bidItems = ordering.map((s) => groups.get(s)!);

    const buf = buildEstimateWorkbook({
      jobNumber: ie.jobNumber,
      projectName: ie.projectName,
      rateType: ie.rateType,
      oppPercent: ie.oppPercent,
      directCostCents: ie.directCostCents,
      oppMarkupCents: ie.oppMarkupCents,
      bidPriceCents: ie.bidPriceCents,
      bidItems,
    });

    const filename = `Est_${ie.jobNumber}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) { next(err); }
});

importedEstimatesRouter.get('/:id/audit', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

    // Pull all master rates that might back a cost code.
    const [materials, labor, equip, equipRental] = await Promise.all([
      prisma.material.findMany({ where: { companyId, deletedAt: null } }),
      prisma.laborRate.findMany({ where: { companyId, deletedAt: null } }),
      prisma.equipmentRate.findMany({ where: { companyId, deletedAt: null } }),
      prisma.equipmentRental.findMany({ where: { companyId, deletedAt: null } }),
    ]);

    interface MasterRow { code: string; unitCostCents: number; source: string }
    const master = new Map<string, MasterRow>();
    for (const m of materials) master.set(m.code.toUpperCase(), { code: m.code, unitCostCents: m.unitCostCents, source: 'Materials' });
    for (const lr of labor) master.set(lr.code.toUpperCase(), { code: lr.code, unitCostCents: lr.baseCentsPW, source: 'Labor_Rates(PW)' });
    for (const eq of equip) master.set(eq.code.toUpperCase(), { code: eq.code, unitCostCents: eq.hourlyCents, source: 'Equipment_Rates' });
    for (const er of equipRental) {
      const c = er.code.toUpperCase();
      const best = er.dailyCents || er.hourlyCents || er.weeklyCents || er.monthlyCents || 0;
      master.set(c, { code: er.code, unitCostCents: best, source: 'Equipment_Rental' });
    }

    interface Finding {
      lineIdx: number;
      costCode: string;
      description: string;
      lineUnitCostCents: number;
      masterUnitCostCents: number;
      deltaPct: number;
      source: string;
      severity: 'low' | 'med' | 'high';
    }
    const findings: Finding[] = [];

    ie.lines.forEach((ln, idx) => {
      const code = (ln.costCode ?? '').trim().toUpperCase();
      if (!code) return;
      const m = master.get(code);
      if (!m || m.unitCostCents === 0) return;
      const delta = (ln.unitCostCents - m.unitCostCents) / m.unitCostCents;
      const absDelta = Math.abs(delta);
      if (absDelta < 0.25) return; // tolerance
      let severity: 'low' | 'med' | 'high' = 'low';
      if (absDelta >= 1.0) severity = 'high';
      else if (absDelta >= 0.5) severity = 'med';
      findings.push({
        lineIdx: idx,
        costCode: code,
        description: ln.description,
        lineUnitCostCents: ln.unitCostCents,
        masterUnitCostCents: m.unitCostCents,
        deltaPct: delta,
        source: m.source,
        severity,
      });
    });

    findings.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
    res.json({ findings });
  } catch (err) { next(err); }
});

importedEstimatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteImportedEstimate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});
