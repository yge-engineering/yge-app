// Equipment rates master routes — owned + rental rate book.

import { Router } from 'express';
import { prisma } from '@yge/db';
import {
  EquipmentRateCreateSchema,
  EquipmentRateKindSchema,
  EquipmentRatePatchSchema,
} from '@yge/shared';
import {
  createEquipmentRate,
  deleteEquipmentRate,
  getEquipmentRate,
  listEquipmentRates,
  updateEquipmentRate,
} from '../lib/equipment-rates-store';

export const equipmentRatesRouter = Router();

equipmentRatesRouter.get('/usage', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

    interface Row {
      code: string;
      description: string;
      bidHours: number;
      bidCents: number;
      actHours: number;
      actCents: number;
      varianceCents: number;
      jobs: Set<string>;
    }
    const map = new Map<string, Row>();
    function ensure(code: string, description: string): Row {
      const k = code.toUpperCase();
      let r = map.get(k);
      if (!r) {
        r = {
          code: k,
          description: description || k,
          bidHours: 0, bidCents: 0,
          actHours: 0, actCents: 0,
          varianceCents: 0,
          jobs: new Set<string>(),
        };
        map.set(k, r);
      }
      return r;
    }

    // Bid side: imported estimate lines with cost codes starting with EQP-.
    const ies = await prisma.importedEstimate.findMany({ where: { companyId, deletedAt: null } });
    for (const ie of ies) {
      const d = ie.data as { jobId?: string; jobNumber?: string; lines?: Array<{ costCode?: string; description?: string; quantity?: number; totalCostCents?: number }> } | null;
      const job = d?.jobNumber ?? '';
      for (const ln of d?.lines ?? []) {
        const code = (ln.costCode ?? '').trim().toUpperCase();
        if (!code.startsWith('EQP-')) continue;
        const r = ensure(code, ln.description ?? '');
        r.bidHours += ln.quantity ?? 0;
        r.bidCents += ln.totalCostCents ?? 0;
        if (job) r.jobs.add(job);
      }
    }

    // Actual side: daily report lines with EQP- codes.
    const reports = await prisma.dailyReport.findMany({ where: { companyId, deletedAt: null } });
    for (const rep of reports) {
      const d = rep.data as { lines?: Array<{ costCode?: string | null; description?: string | null; qtyHrs?: number | null; totalCostCents?: number | null; jobNumber?: string | null }> } | null;
      for (const ln of d?.lines ?? []) {
        const code = (ln.costCode ?? '').trim().toUpperCase();
        if (!code.startsWith('EQP-')) continue;
        const r = ensure(code, ln.description ?? '');
        r.actHours += ln.qtyHrs ?? 0;
        r.actCents += ln.totalCostCents ?? 0;
        if (ln.jobNumber) r.jobs.add(ln.jobNumber);
      }
    }

    const rows = [...map.values()].map((r) => ({
      code: r.code,
      description: r.description,
      bidHours: r.bidHours,
      bidCents: r.bidCents,
      actHours: r.actHours,
      actCents: r.actCents,
      varianceCents: r.bidCents - r.actCents,
      jobs: [...r.jobs],
    }));
    rows.sort((a, b) => (b.bidCents + b.actCents) - (a.bidCents + a.actCents));

    res.json({ rows });
  } catch (err) { next(err); }
});

equipmentRatesRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const owned = await prisma.equipmentRate.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: 'asc' } });
    const rentals = await prisma.equipmentRental.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: 'asc' } });

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }
    const lines: string[] = [];
    lines.push('code,name,kind,hourlyRate,dailyRate,weeklyRate,monthlyRate,vendor');
    for (const r of owned) {
      lines.push([
        esc(r.code), esc(r.name), 'OWNED',
        esc((r.hourlyCents / 100).toFixed(2)),
        '', '', '',
        '',
      ].join(','));
    }
    for (const r of rentals) {
      lines.push([
        esc(r.code), esc(r.name), 'RENTAL',
        esc(((r.hourlyCents ?? 0) / 100).toFixed(2)),
        esc(((r.dailyCents ?? 0) / 100).toFixed(2)),
        esc(((r.weeklyCents ?? 0) / 100).toFixed(2)),
        esc(((r.monthlyCents ?? 0) / 100).toFixed(2)),
        esc(r.vendor ?? ''),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment-rates.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});


equipmentRatesRouter.get('/', async (req, res, next) => {
  try {
    const kindRaw = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const kindParsed = kindRaw ? EquipmentRateKindSchema.safeParse(kindRaw) : null;
    const equipmentRates = await listEquipmentRates({
      ...(kindParsed?.success ? { kind: kindParsed.data } : {}),
    });
    return res.json({ equipmentRates });
  } catch (err) { next(err); }
});

equipmentRatesRouter.get('/:id', async (req, res, next) => {
  try {
    const er = await getEquipmentRate(req.params.id);
    if (!er) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ equipmentRate: er });
  } catch (err) { next(err); }
});

equipmentRatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EquipmentRateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const er = await createEquipmentRate(parsed.data);
    return res.status(201).json({ equipmentRate: er });
  } catch (err) { next(err); }
});

equipmentRatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EquipmentRatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEquipmentRate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ equipmentRate: updated });
  } catch (err) { next(err); }
});

equipmentRatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteEquipmentRate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});
