// Cost codes master routes — CRUD for the master reference list.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { CostCodeCreateSchema, CostCodePatchSchema } from '@yge/shared';
import {
  createCostCode,
  deleteCostCode,
  getCostCode,
  listCostCodes,
  updateCostCode,
} from '../lib/cost-codes-store';

export const costCodesRouter = Router();

costCodesRouter.get('/', async (_req, res, next) => {
  try {
    const costCodes = await listCostCodes();
    return res.json({ costCodes });
  } catch (err) { next(err); }
});

// GET /api/cost-codes/stats — usage rollup across estimates + daily reports.
// MUST come before /:id so the wildcard doesn't swallow it.
costCodesRouter.get('/stats', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    type Stat = { code: string; bidUses: number; bidCents: number; actUses: number; actCents: number };
    const map = new Map<string, Stat>();
    function ensure(code: string): Stat {
      const k = code.toUpperCase();
      let st = map.get(k);
      if (!st) {
        st = { code: k, bidUses: 0, bidCents: 0, actUses: 0, actCents: 0 };
        map.set(k, st);
      }
      return st;
    }

    const ies = await prisma.importedEstimate.findMany({ where: { companyId, deletedAt: null } });
    for (const ie of ies) {
      const d = ie.data as { lines?: Array<{ costCode?: string; bidPriceCents?: number }> } | null;
      for (const ln of d?.lines ?? []) {
        const c = (ln.costCode ?? '').trim();
        if (!c) continue;
        const st = ensure(c);
        st.bidUses += 1;
        st.bidCents += ln.bidPriceCents ?? 0;
      }
    }

    const reports = await prisma.dailyReport.findMany({ where: { companyId, deletedAt: null } });
    for (const r of reports) {
      const d = r.data as { lines?: Array<{ costCode?: string | null; totalCostCents?: number | null }> } | null;
      for (const ln of d?.lines ?? []) {
        const c = (ln.costCode ?? '').trim();
        if (!c) continue;
        const st = ensure(c);
        st.actUses += 1;
        st.actCents += ln.totalCostCents ?? 0;
      }
    }

    const stats = [...map.values()].sort((a, b) => b.bidCents - a.bidCents);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

costCodesRouter.get('/trends', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const ies = await prisma.importedEstimate.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // For each code: list of {unitCostCents, createdAt} sorted newest first.
    interface History { unitCostCents: number; createdAt: string }
    const map = new Map<string, History[]>();
    for (const ie of ies) {
      const d = ie.data as { lines?: Array<{ costCode?: string; unitCostCents?: number }> } | null;
      const seen = new Set<string>();
      for (const ln of d?.lines ?? []) {
        const c = (ln.costCode ?? '').trim().toUpperCase();
        if (!c || seen.has(c)) continue;
        seen.add(c);
        if (!ln.unitCostCents) continue;
        const arr = map.get(c) ?? [];
        arr.push({ unitCostCents: ln.unitCostCents, createdAt: ie.createdAt.toISOString() });
        map.set(c, arr);
      }
    }

    interface Trend {
      code: string;
      latestCents: number;
      previousCents: number;
      deltaPct: number;
      samples: number;
      direction: 'up' | 'down' | 'flat';
    }
    const trends: Trend[] = [];
    for (const [code, hist] of map.entries()) {
      if (hist.length < 2) continue;
      const latest = hist[0]!.unitCostCents;
      const prev = hist[1]!.unitCostCents;
      if (!prev || !latest) continue;
      const delta = (latest - prev) / prev;
      const direction = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
      trends.push({ code, latestCents: latest, previousCents: prev, deltaPct: delta, samples: hist.length, direction });
    }
    trends.sort((a, b) => b.deltaPct - a.deltaPct);

    res.json({
      trends,
      climbing: trends.filter((t) => t.deltaPct > 0.2),
      falling: trends.filter((t) => t.deltaPct < -0.2),
    });
  } catch (err) { next(err); }
});

costCodesRouter.get('/:id', async (req, res, next) => {
  try {
    const cc = await getCostCode(req.params.id);
    if (!cc) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ costCode: cc });
  } catch (err) { next(err); }
});

costCodesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CostCodeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const cc = await createCostCode(parsed.data);
    return res.status(201).json({ costCode: cc });
  } catch (err) { next(err); }
});

costCodesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CostCodePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCostCode(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ costCode: updated });
  } catch (err) { next(err); }
});

costCodesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteCostCode(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/cost-codes/:code/resolve?rateType=PW|Private|DB|IBEW
// — look up the rate row matching this cost code (Labor / Equipment
// Owned / Equipment Rental / Material) and return the unit cost.
costCodesRouter.get('/:code/history', async (req, res, next) => {
  try {
    const code = String(req.params.code ?? '').toUpperCase();
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));

    const ies = await prisma.importedEstimate.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    interface Row {
      estimateId: string;
      jobNumber: string;
      projectName: string;
      createdAt: string;
      quantity: number;
      unitCostCents: number;
      totalCostCents: number;
      bidPriceCents: number;
      description: string;
    }
    const rows: Row[] = [];
    for (const ie of ies) {
      const d = ie.data as { projectName?: string; lines?: Array<{ costCode?: string; quantity?: number; unitCostCents?: number; totalCostCents?: number; bidPriceCents?: number; description?: string }> } | null;
      for (const ln of d?.lines ?? []) {
        const c = (ln.costCode ?? '').trim().toUpperCase();
        if (c !== code) continue;
        rows.push({
          estimateId: ie.id,
          jobNumber: ie.jobNumber,
          projectName: d?.projectName ?? '',
          createdAt: ie.createdAt.toISOString(),
          quantity: ln.quantity ?? 0,
          unitCostCents: ln.unitCostCents ?? 0,
          totalCostCents: ln.totalCostCents ?? 0,
          bidPriceCents: ln.bidPriceCents ?? 0,
          description: ln.description ?? '',
        });
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }

    res.json({ code, rows });
  } catch (err) { next(err); }
});

costCodesRouter.get('/:code/resolve', async (req, res, next) => {
  try {
    const code = String(req.params.code ?? '').toUpperCase();
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const rateType = String(req.query.rateType ?? 'PW').toUpperCase();
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

    const cc = await prisma.costCode.findFirst({
      where: { companyId, code, deletedAt: null },
    });
    if (!cc) {
      return res.json({ code, found: false });
    }

    // Determine which rate table to look up based on the code prefix
    // (matching the YGE workbook conventions).
    let category = cc.category ?? null;
    let unit = 'hr';
    let unitCostCents = 0;
    let rateSource: string | null = null;

    if (code.startsWith('LAB-')) {
      const lr = await prisma.laborRate.findFirst({
        where: { companyId, code, deletedAt: null },
      });
      if (lr) {
        switch (rateType) {
          case 'PRIVATE':
            unitCostCents = lr.baseCentsPrivate;
            break;
          case 'DB':
            unitCostCents = lr.baseCentsDB;
            break;
          case 'IBEW':
            unitCostCents = lr.baseCentsIBEW ?? lr.baseCentsPW;
            break;
          default:
            unitCostCents = lr.baseCentsPW;
        }
        rateSource = 'Labor_Rates';
        category = category ?? 'Labor';
      }
    } else if (code.startsWith('EQP-R-')) {
      const er = await prisma.equipmentRental.findFirst({
        where: { companyId, code, deletedAt: null },
      });
      if (er) {
        // Prefer daily, fall back to hourly. Edit mode user can switch unit.
        if (er.dailyCents) {
          unitCostCents = er.dailyCents;
          unit = 'day';
        } else if (er.hourlyCents) {
          unitCostCents = er.hourlyCents;
          unit = 'hr';
        } else if (er.weeklyCents) {
          unitCostCents = er.weeklyCents;
          unit = 'week';
        } else if (er.monthlyCents) {
          unitCostCents = er.monthlyCents;
          unit = 'month';
        }
        rateSource = 'Equipment_Rental';
        category = category ?? 'Equipment (Rental)';
      }
    } else if (code.startsWith('EQP-')) {
      const eq = await prisma.equipmentRate.findFirst({
        where: { companyId, code, deletedAt: null },
      });
      if (eq) {
        unitCostCents = eq.hourlyCents;
        unit = 'hr';
        rateSource = 'Equipment_Rates';
        category = category ?? 'Equipment (Owned)';
      }
    } else if (code.startsWith('MAT-')) {
      const m = await prisma.material.findFirst({
        where: { companyId, code, deletedAt: null },
      });
      if (m) {
        unitCostCents = m.unitCostCents;
        unit = m.unit;
        rateSource = 'Materials';
        category = category ?? 'Material';
      }
    }

    res.json({
      code: cc.code,
      name: cc.name,
      category,
      unit,
      unitCostCents,
      rateSource,
      found: true,
    });
  } catch (err) {
    next(err);
  }
});

