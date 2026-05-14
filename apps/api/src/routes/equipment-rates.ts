// audit: CSV uploads log to request-id middleware; review with /admin/audit-log.
// Equipment rates master routes — owned + rental rate book.

import { Router } from 'express';
import multer from 'multer';

const eqUpload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
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

equipmentRatesRouter.post('/import-csv', eqUpload.single('file'), async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? '') === '1';

    function parseCsv(s: string): string[][] {
      const rows: string[][] = [];
      let row: string[] = []; let cell = ''; let inQ = false;
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
    const iCode = idx('code'), iName = idx('name'), iKind = idx('kind'), iHourly = idx('hourlyRate');
    const iDaily = idx('dailyRate'), iWeekly = idx('weeklyRate'), iMonthly = idx('monthlyRate'), iVendor = idx('vendor');
    if (iCode < 0 || iName < 0 || iKind < 0 || iHourly < 0) {
      return res.status(400).json({ error: 'CSV must have code, name, kind, hourlyRate columns' });
    }

    const summary = { total: rows.length - 1, created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; reason: string }>, dryRun };
    const owned = await prisma.equipmentRate.findMany({ where: { companyId, deletedAt: null } });
    const rentals = await prisma.equipmentRental.findMany({ where: { companyId, deletedAt: null } });

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const code = (row[iCode] ?? '').trim();
      const name = (row[iName] ?? '').trim();
      const kind = (row[iKind] ?? '').trim().toUpperCase();
      const hourly = Math.round(Number((row[iHourly] ?? '0').replace(/[$,]/g, '')) * 100);
      if (!code || !name) { summary.errors.push({ row: r + 1, reason: 'missing code/name' }); summary.skipped++; continue; }
      if (kind !== 'OWNED' && kind !== 'RENTAL') {
        summary.errors.push({ row: r + 1, reason: `kind must be OWNED or RENTAL` });
        summary.skipped++;
        continue;
      }

      if (kind === 'OWNED') {
        const existing = owned.find((e) => e.code.toUpperCase() === code.toUpperCase());
        if (dryRun) { if (existing) summary.updated++; else summary.created++; continue; }
        if (existing) {
          await prisma.equipmentRate.update({ where: { id: existing.id }, data: { name, hourlyCents: hourly } });
          summary.updated++;
        } else {
          await prisma.equipmentRate.create({ data: { companyId, code, name, hourlyCents: hourly } });
          summary.created++;
        }
      } else {
        const daily = iDaily >= 0 ? Math.round(Number((row[iDaily] ?? '0').replace(/[$,]/g, '')) * 100) : null;
        const weekly = iWeekly >= 0 ? Math.round(Number((row[iWeekly] ?? '0').replace(/[$,]/g, '')) * 100) : null;
        const monthly = iMonthly >= 0 ? Math.round(Number((row[iMonthly] ?? '0').replace(/[$,]/g, '')) * 100) : null;
        const vendor = iVendor >= 0 ? (row[iVendor] ?? '').trim() || null : null;
        const existing = rentals.find((e) => e.code.toUpperCase() === code.toUpperCase());
        if (dryRun) { if (existing) summary.updated++; else summary.created++; continue; }
        if (existing) {
          await prisma.equipmentRental.update({
            where: { id: existing.id },
            data: { name, hourlyCents: hourly || null, dailyCents: daily, weeklyCents: weekly, monthlyCents: monthly, vendor },
          });
          summary.updated++;
        } else {
          await prisma.equipmentRental.create({
            data: { companyId, code, name, hourlyCents: hourly || null, dailyCents: daily, weeklyCents: weekly, monthlyCents: monthly, vendor },
          });
          summary.created++;
        }
      }
    }

    res.json({ summary });
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
