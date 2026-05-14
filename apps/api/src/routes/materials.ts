// audit: CSV uploads log to request-id middleware; review with /admin/audit-log.
// Materials routes — parts inventory + stock movement ledger.

import { Router } from 'express';
import multer from 'multer';

const materialUpload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
import { prisma } from '@yge/db';
import {
  MaterialCreateSchema,
  MaterialPatchSchema,
  StockMovementCreateSchema,
} from '@yge/shared';
import {
  createMaterial,
  getMaterial,
  listMaterials,
  recordMovement,
  updateMaterial,
} from '../lib/materials-store';

export const materialsRouter = Router();

materialsRouter.get('/', async (req, res, next) => {
  try {
    const materials = await listMaterials({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      belowReorder: req.query.belowReorder === 'true',
    });
    return res.json({ materials });
  } catch (err) {
    next(err);
  }
});

materialsRouter.post('/import-csv', materialUpload.single('file'), async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? '') === '1';

    function parseCsv(s: string): string[][] {
      const rows: string[][] = [];
      let row: string[] = [];
      let cell = '';
      let inQ = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inQ) {
          if (c === '"' && s[i + 1] === '"') { cell += '"'; i += 1; }
          else if (c === '"') { inQ = false; }
          else { cell += c; }
        } else {
          if (c === '"') { inQ = true; }
          else if (c === ',') { row.push(cell); cell = ''; }
          else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i += 1;
            row.push(cell); cell = '';
            if (row.some((x) => x.length > 0)) rows.push(row);
            row = [];
          } else { cell += c; }
        }
      }
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        if (row.some((x) => x.length > 0)) rows.push(row);
      }
      return rows;
    }

    const rows = parseCsv(req.file.buffer.toString('utf8'));
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty' });
    const header = (rows[0] ?? []).map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);
    const iCode = idx('code'), iName = idx('name'), iUnit = idx('unit'), iCost = idx('unitCost');
    if (iCode < 0 || iName < 0 || iUnit < 0 || iCost < 0) {
      return res.status(400).json({ error: 'CSV must have code, name, unit, unitCost columns' });
    }

    const summary = { total: rows.length - 1, created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; reason: string }>, dryRun };
    const all = await prisma.material.findMany({ where: { companyId, deletedAt: null } });

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const code = (row[iCode] ?? '').trim();
      const name = (row[iName] ?? '').trim();
      const unit = (row[iUnit] ?? '').trim() || 'EA';
      const costStr = (row[iCost] ?? '').trim().replace(/[$,]/g, '');
      const cost = Number(costStr);
      if (!code || !name || !Number.isFinite(cost) || cost < 0) {
        summary.errors.push({ row: r + 1, reason: 'invalid row' });
        summary.skipped++;
        continue;
      }
      const cents = Math.round(cost * 100);
      const existing = all.find((m) => m.code.toUpperCase() === code.toUpperCase());
      if (dryRun) {
        if (existing) summary.updated++; else summary.created++;
        continue;
      }
      if (existing) {
        await prisma.material.update({
          where: { id: existing.id },
          data: { name, unit, unitCostCents: cents },
        });
        summary.updated++;
      } else {
        await prisma.material.create({
          data: { companyId, code, name, unit, unitCostCents: cents },
        });
        summary.created++;
      }
    }
    res.json({ summary });
  } catch (err) { next(err); }
});

materialsRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const rows = await prisma.material.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }
    const lines: string[] = [];
    lines.push('code,name,unit,unitCost,category,notes');
    for (const m of rows) {
      const d = (m.data as Record<string, unknown> | null) ?? {};
      lines.push([
        esc(m.code),
        esc(m.name),
        esc(m.unit),
        esc((m.unitCostCents / 100).toFixed(2)),
        esc((d.category as string) ?? ''),
        esc((d.notes as string) ?? ''),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="materials.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

materialsRouter.get('/staleness', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const mats = await prisma.material.findMany({
      where: { companyId, deletedAt: null },
    });
    const now = Date.now();
    const rows = mats.map((m) => {
      const ageMs = now - m.updatedAt.getTime();
      const ageDays = Math.floor(ageMs / 86400000);
      const severity: 'fresh' | 'stale' | 'very_stale' =
        ageDays > 365 ? 'very_stale' : ageDays > 180 ? 'stale' : 'fresh';
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        unitCostCents: m.unitCostCents,
        updatedAt: m.updatedAt.toISOString(),
        ageDays,
        severity,
      };
    });
    rows.sort((a, b) => b.ageDays - a.ageDays);
    res.json({
      rows,
      fresh: rows.filter((r) => r.severity === 'fresh').length,
      stale: rows.filter((r) => r.severity === 'stale').length,
      veryStale: rows.filter((r) => r.severity === 'very_stale').length,
    });
  } catch (err) { next(err); }
});



materialsRouter.get('/:id', async (req, res, next) => {
  try {
    const m = await getMaterial(req.params.id);
    if (!m) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: m });
  } catch (err) {
    next(err);
  }
});

materialsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = MaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const m = await createMaterial(parsed.data);
    return res.status(201).json({ material: m });
  } catch (err) {
    next(err);
  }
});

materialsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = MaterialPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateMaterial(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/:id/movement — append a stock movement.
materialsRouter.post('/:id/movement', async (req, res, next) => {
  try {
    const parsed = StockMovementCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await recordMovement(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: updated });
  } catch (err) {
    next(err);
  }
});
