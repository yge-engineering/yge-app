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

// -----------------------------------------------------------------
// A2: people-jobs import (subs/employees/jobs)
// -----------------------------------------------------------------

import { parsePeopleJobs } from '../lib/excel-master-tables';
import { randomUUID } from 'node:crypto';

excelImportRouter.post(
  '/people-jobs',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const dryRun = String(req.query.dryRun ?? '') === '1';
      const parsed = parsePeopleJobs(req.file.buffer);

      const summary = {
        subcontractors: { parsed: parsed.subcontractors.length, written: 0, skipped: 0 },
        employees: { parsed: parsed.employees.length, written: 0, skipped: 0 },
        jobs: { parsed: parsed.jobs.length, written: 0, skipped: 0 },
        warnings: parsed.warnings,
        dryRun,
      };

      if (dryRun) {
        return res.json({
          summary,
          sample: {
            subcontractor: parsed.subcontractors[0],
            employee: parsed.employees[0],
            job: parsed.jobs[0],
          },
        });
      }

      const co = companyId();

      // Subcontractors → Vendor (kind=SUBCONTRACTOR). Dedupe by legalName.
      for (const s of parsed.subcontractors) {
        // The Vendor model stores everything in a Json `data` blob.
        const existing = await prisma.vendor.findFirst({
          where: { companyId: co, deletedAt: null },
        });
        // For dedupe we need to scan data.legalName ourselves.
        const allVendors = await prisma.vendor.findMany({
          where: { companyId: co, deletedAt: null },
        });
        const match = allVendors.find((v) => {
          const data = v.data as { legalName?: string } | null;
          return data?.legalName === s.name;
        });
        const data = {
          legalName: s.name,
          dbaName: s.name,
          kind: 'SUBCONTRACTOR',
          contactName: s.contactName,
          phone: s.phone,
          email: s.email,
          tradeSpecialty: s.trade,
          licenseNumber: s.license,
          notes: [s.rateNotes, s.status ? `Status: ${s.status}` : null]
            .filter(Boolean)
            .join('\n') || undefined,
          is1099Reportable: true,
          paymentTerms: 'NET_30',
        };
        if (match) {
          await prisma.vendor.update({
            where: { id: match.id },
            data: { data: { ...(match.data as object), ...data } },
          });
        } else {
          await prisma.vendor.create({
            data: {
              id: 'vnd-' + randomUUID().replace(/-/g, '').slice(0, 12),
              companyId: co,
              data,
            },
          });
        }
        summary.subcontractors.written++;
      }

      // Employees. Dedupe by (firstName, lastName).
      for (const e of parsed.employees) {
        const existing = await prisma.employee.findFirst({
          where: {
            companyId: co,
            firstName: e.firstName,
            lastName: e.lastName,
            deletedAt: null,
          },
        });
        const data = {
          laborCostCode: e.laborCostCode,
          phone: e.phone,
          email: e.email,
          notes: e.notes,
        };
        if (existing) {
          await prisma.employee.update({
            where: { id: existing.id },
            data: {
              classification: e.classification ?? existing.classification,
              status: e.active ? 'ACTIVE' : 'TERMINATED',
              data,
            },
          });
        } else {
          await prisma.employee.create({
            data: {
              companyId: co,
              firstName: e.firstName,
              lastName: e.lastName,
              hireDate: new Date(),
              classification: e.classification ?? 'Unknown',
              status: e.active ? 'ACTIVE' : 'TERMINATED',
              data,
            },
          });
        }
        summary.employees.written++;
      }

      // Jobs. Dedupe by jobNumber.
      function mapStatus(s: string | null): 'BIDDING' | 'AWARDED' | 'ACTIVE' | 'ON_HOLD' | 'CLOSED' | 'LOST' {
        switch ((s ?? '').toLowerCase().replace(/\s+/g, '_')) {
          case 'bidding':
          case 'pursuing':
          case 'submitted':
          case 'bid_submitted':
            return 'BIDDING';
          case 'awarded':
            return 'AWARDED';
          case 'active':
          case 'in_progress':
            return 'ACTIVE';
          case 'on_hold':
            return 'ON_HOLD';
          case 'lost':
            return 'LOST';
          case 'archived':
          case 'closed':
            return 'CLOSED';
          default:
            return 'BIDDING';
        }
      }
      function mapRateType(s: string | null): 'PW' | 'PRIVATE' {
        const v = (s ?? '').toLowerCase();
        return v.includes('priv') ? 'PRIVATE' : 'PW';
      }
      for (const j of parsed.jobs) {
        const existing = await prisma.job.findFirst({
          where: { companyId: co, jobNumber: j.jobNumber, deletedAt: null },
        });
        const data = {
          client: j.client,
          address: j.address,
          budgetLaborCents: j.budgetLaborCents,
          budgetMaterialsCents: j.budgetMaterialsCents,
          budgetEquipmentCents: j.budgetEquipmentCents,
          budgetSubsCents: j.budgetSubsCents,
          budgetOtherCents: j.budgetOtherCents,
          totalBudgetCents: j.totalBudgetCents,
          importedFromExcel: true,
        };
        const dbStatus = mapStatus(j.status);
        const rateType = mapRateType(j.rateType);
        const estStart = j.startDate ? new Date(j.startDate) : null;
        if (existing) {
          await prisma.job.update({
            where: { id: existing.id },
            data: {
              name: j.name,
              status: dbStatus,
              rateType,
              estStart,
              data: { ...(existing.data as object), ...data },
            },
          });
        } else {
          await prisma.job.create({
            data: {
              companyId: co,
              jobNumber: j.jobNumber,
              name: j.name,
              status: dbStatus,
              rateType,
              estStart,
              data,
            },
          });
        }
        summary.jobs.written++;
      }

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);
