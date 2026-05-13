// Excel import routes — accept the YGE workbook + idempotently upsert
// master data into Prisma. Diagnostic / one-shot tooling; survives
// re-runs because every upsert is keyed by (companyId, code).

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@yge/db';
import { parseMasterTables } from '../lib/excel-master-tables';

export const excelImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

excelImportRouter.post(
  '/master-tables',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const dryRun = String(req.query.dryRun ?? '') === '1';
      const parsed = parseMasterTables(req.file.buffer);

      // Build summary first (so dry-run can preview).
      const summary = {
        costCodes: { parsed: parsed.costCodes.length, written: 0 },
        laborRates: { parsed: parsed.laborRates.length, written: 0 },
        equipmentRates: { parsed: parsed.equipmentRates.length, written: 0 },
        equipmentRental: { parsed: parsed.equipmentRental.length, written: 0 },
        materials: { parsed: parsed.materials.length, written: 0 },
        warnings: parsed.warnings,
        dryRun,
      };

      if (dryRun) {
        return res.json({
          summary,
          sample: {
            costCode: parsed.costCodes[0],
            laborRate: parsed.laborRates[0],
            equipmentRate: parsed.equipmentRates[0],
            equipmentRental: parsed.equipmentRental[0],
            material: parsed.materials[0],
          },
        });
      }

      const co = companyId();

      // Cost codes.
      for (const cc of parsed.costCodes) {
        await prisma.costCode.upsert({
          where: { companyId_code: { companyId: co, code: cc.code } },
          create: {
            companyId: co,
            code: cc.code,
            name: cc.name,
            category: cc.category,
            data: { rateSource: cc.rateSource },
          },
          update: {
            name: cc.name,
            category: cc.category,
            data: { rateSource: cc.rateSource },
          },
        });
        summary.costCodes.written++;
      }

      // Labor rates — no @@unique([companyId, code]) on schema yet, so
      // use findFirst→update-or-create pattern instead of upsert.
      for (const lr of parsed.laborRates) {
        const burdenPct = lr.baseWageCents > 0
          ? (lr.pwBurdenedCents - lr.baseWageCents) / lr.baseWageCents
          : 0;
        const data = {
          baseWageCents: lr.baseWageCents,
          hwCents: lr.hwCents,
          pensionCents: lr.pensionCents,
          trainingCents: lr.trainingCents,
          otherCents: lr.otherCents,
          notes: lr.notes,
          rawDirCents: lr.rawDirCents,
        };
        const existing = await prisma.laborRate.findFirst({
          where: { companyId: co, code: lr.code },
        });
        if (existing) {
          await prisma.laborRate.update({
            where: { id: existing.id },
            data: {
              classification: lr.classification,
              burdenPct,
              baseCentsPrivate: lr.privateBurdenedCents,
              baseCentsPW: lr.pwBurdenedCents,
              baseCentsDB: lr.dbBurdenedCents,
              baseCentsIBEW: lr.ibewBurdenedCents,
              data,
            },
          });
        } else {
          await prisma.laborRate.create({
            data: {
              companyId: co,
              code: lr.code,
              classification: lr.classification,
              burdenPct,
              baseCentsPrivate: lr.privateBurdenedCents,
              baseCentsPW: lr.pwBurdenedCents,
              baseCentsDB: lr.dbBurdenedCents,
              baseCentsIBEW: lr.ibewBurdenedCents,
              effectiveFrom: new Date('2026-01-01'),
              source: 'Imported from YGE Job Cost System xlsx',
              data,
            },
          });
        }
        summary.laborRates.written++;
      }

      // Equipment rates.
      for (const eq of parsed.equipmentRates) {
        await prisma.equipmentRate.upsert({
          where: { companyId_code: { companyId: co, code: eq.code } },
          create: {
            companyId: co,
            code: eq.code,
            name: eq.name,
            hourlyCents: eq.totalCents,
            data: {
              bareCents: eq.bareCents,
              gph: eq.gph,
              fuelCentsPerHour: eq.fuelCentsPerHour,
              unit: eq.unit,
              notes: eq.notes,
            },
          },
          update: {
            name: eq.name,
            hourlyCents: eq.totalCents,
            data: {
              bareCents: eq.bareCents,
              gph: eq.gph,
              fuelCentsPerHour: eq.fuelCentsPerHour,
              unit: eq.unit,
              notes: eq.notes,
            },
          },
        });
        summary.equipmentRates.written++;
      }

      // Equipment rental — no @@unique([companyId, code]) yet, so use
      // findFirst→update-or-create pattern.
      for (const er of parsed.equipmentRental) {
        const existing = await prisma.equipmentRental.findFirst({
          where: { companyId: co, code: er.code },
        });
        const payload = {
          name: er.name,
          dailyCents: er.dailyCents,
          weeklyCents: er.weeklyCents,
          monthlyCents: er.monthlyCents,
          vendor: er.source ?? 'I-5 Rentals',
        };
        if (existing) {
          await prisma.equipmentRental.update({
            where: { id: existing.id },
            data: payload,
          });
        } else {
          await prisma.equipmentRental.create({
            data: { companyId: co, code: er.code, ...payload },
          });
        }
        summary.equipmentRental.written++;
      }

      // Materials.
      for (const m of parsed.materials) {
        await prisma.material.upsert({
          where: { companyId_code: { companyId: co, code: m.code } },
          create: {
            companyId: co,
            code: m.code,
            name: m.name,
            unit: m.unit,
            unitCostCents: m.unitCostCents,
            data: { section: m.section, notes: m.notes },
          },
          update: {
            name: m.name,
            unit: m.unit,
            unitCostCents: m.unitCostCents,
            data: { section: m.section, notes: m.notes },
          },
        });
        summary.materials.written++;
      }

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);
