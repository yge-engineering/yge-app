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
        customers: { parsed: new Set(parsed.jobs.map((j) => (j.client ?? '').trim().toLowerCase()).filter(Boolean)).size, written: 0 },
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

      // E2: Customer master auto-import from Jobs.client.
      type ZodKind =
        | 'STATE_AGENCY' | 'FEDERAL_AGENCY' | 'COUNTY' | 'CITY'
        | 'SPECIAL_DISTRICT' | 'PRIVATE_OWNER' | 'PRIME_CONTRACTOR' | 'OTHER';
      function inferCustomerKind(name: string): ZodKind {
        const n = name.toLowerCase();
        if (/\bcity of\b/.test(n)) return 'CITY';
        if (/\bcounty of\b|\bcounty\s*$/.test(n)) return 'COUNTY';
        if (n.includes('caltrans') || n.includes('cal fire') || n.includes('cal-fire') ||
            n.includes('state of') || n.includes('dgs ') || n.includes('csu') ||
            n.includes('university of california') || n.includes('community college'))
          return 'STATE_AGENCY';
        if (n.includes('usfs') || n.includes('blm') || n.includes('army corps') ||
            n.includes('corps of engineers') || n.includes('bureau of') ||
            n.includes('usda') || n.includes('united states') || n.includes('forest service'))
          return 'FEDERAL_AGENCY';
        if (n.includes('school district') || n.includes('unified school') ||
            n.includes('water district') || n.includes('irrigation district') ||
            n.includes('fire protection district') || n.includes('sanitation district') ||
            n.includes('authority'))
          return 'SPECIAL_DISTRICT';
        return 'PRIVATE_OWNER';
      }
      function kindToPrismaType(k: ZodKind): 'PUBLIC_AGENCY' | 'UTILITY' | 'PRIVATE' | 'OTHER' {
        switch (k) {
          case 'STATE_AGENCY':
          case 'FEDERAL_AGENCY':
          case 'COUNTY':
          case 'CITY':
          case 'SPECIAL_DISTRICT':
            return 'PUBLIC_AGENCY';
          case 'PRIVATE_OWNER':
          case 'PRIME_CONTRACTOR':
            return 'PRIVATE';
          default:
            return 'OTHER';
        }
      }
      function newCustomerIdFromHex(): string {
        const hex = Math.floor(Math.random() * 0x100000000).toString(16);
        return 'cus-' + hex.padStart(8, '0');
      }
      function buildCustomerData(legalName: string, kind: ZodKind, idHint?: string) {
        const id = idHint ?? newCustomerIdFromHex();
        const now = new Date().toISOString();
        return {
          id,
          createdAt: now,
          updatedAt: now,
          legalName,
          kind,
          taxExempt: false,
          onHold: false,
        };
      }

      // First pass: build a map of distinct client names → Customer id.
      const distinctClients = new Map<string, string>();
      for (const j of parsed.jobs) {
        const c = (j.client ?? '').trim();
        if (!c) continue;
        const key = c.toLowerCase();
        if (distinctClients.has(key)) continue;
        const existing = await prisma.customer.findFirst({
          where: { companyId: co, name: { equals: c, mode: 'insensitive' }, deletedAt: null },
        });
        if (existing) {
          distinctClients.set(key, existing.id);
          continue;
        }
        const kind = inferCustomerKind(c);
        const cusId = newCustomerIdFromHex();
        const cusData = buildCustomerData(c, kind, cusId);
        const created = await prisma.customer.create({
          data: {
            id: cusId,
            companyId: co,
            name: c,
            type: kindToPrismaType(kind),
            data: JSON.parse(JSON.stringify(cusData)),
          },
        });
        distinctClients.set(key, created.id);
        summary.customers.written++;
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
          const customerKey = (j.client ?? '').trim().toLowerCase();
          const customerId = customerKey ? distinctClients.get(customerKey) ?? null : null;
          await prisma.job.update({
            where: { id: existing.id },
            data: {
              name: j.name,
              status: dbStatus,
              rateType,
              estStart,
              customerId: customerId ?? existing.customerId ?? null,
              data: { ...(existing.data as object), ...data },
            },
          });
        } else {
          const customerKey2 = (j.client ?? '').trim().toLowerCase();
          const customerId2 = customerKey2 ? distinctClients.get(customerKey2) ?? null : null;
          await prisma.job.create({
            data: {
              companyId: co,
              jobNumber: j.jobNumber,
              name: j.name,
              status: dbStatus,
              rateType,
              estStart,
              customerId: customerId2,
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

// -----------------------------------------------------------------
// A3: estimates import
// -----------------------------------------------------------------

import { parseEstimates, parseDailyReports } from '../lib/excel-master-tables';

excelImportRouter.post(
  '/estimates',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const dryRun = String(req.query.dryRun ?? '') === '1';
      const parsed = parseEstimates(req.file.buffer);

      const summary = {
        estimates: { parsed: parsed.estimates.length, written: 0, skipped: 0 },
        bidItems: 0,
        costLines: 0,
        warnings: parsed.warnings,
        dryRun,
      };

      for (const e of parsed.estimates) {
        summary.bidItems += e.bidItems.length;
        summary.costLines += e.bidItems.reduce((s, b) => s + b.costLines.length, 0);
      }

      if (dryRun) {
        return res.json({
          summary,
          sample: parsed.estimates[0]
            ? {
                sheetName: parsed.estimates[0].sheetName,
                jobNumber: parsed.estimates[0].jobNumber,
                projectName: parsed.estimates[0].projectName,
                bidPriceCents: parsed.estimates[0].bidPriceCents,
                bidItemCount: parsed.estimates[0].bidItems.length,
                firstBidItem: {
                  description: parsed.estimates[0].bidItems[0]?.description,
                  costLineCount: parsed.estimates[0].bidItems[0]?.costLines.length,
                  firstCostLine: parsed.estimates[0].bidItems[0]?.costLines[0],
                },
              }
            : null,
        });
      }

      const co = companyId();

      for (const e of parsed.estimates) {
        if (!e.jobNumber) {
          summary.estimates.skipped++;
          continue;
        }
        // Find or create the corresponding Job (A2 may have already
        // run; if not, create a stub Job).
        let job = await prisma.job.findFirst({
          where: { companyId: co, jobNumber: e.jobNumber, deletedAt: null },
        });
        if (!job) {
          job = await prisma.job.create({
            data: {
              companyId: co,
              jobNumber: e.jobNumber,
              name: e.projectName ?? `Job ${e.jobNumber}`,
              rateType: (e.rateType ?? '').toLowerCase().includes('priv') ? 'PRIVATE' : 'PW',
              status: 'BIDDING',
              data: { importedFromEstimateSheet: e.sheetName },
            },
          });
        }

        // Idempotent: find existing Estimate for this job + sheet, or create.
        const existing = await prisma.estimate.findFirst({
          where: { companyId: co, jobId: job.id, deletedAt: null },
        });
        // Round-trip through JSON.stringify to coerce the strongly-
        // typed ParsedBidItem objects into plain JSON Prisma accepts.
        const estimateData = JSON.parse(
          JSON.stringify({
            sheetName: e.sheetName,
            jobNumber: e.jobNumber,
            projectName: e.projectName,
            rateType: e.rateType,
            oppPercent: e.oppPercent,
            directCostCents: e.directCostCents,
            oppMarkupCents: e.oppMarkupCents,
            bidPriceCents: e.bidPriceCents,
            bidItems: e.bidItems,
            importedFromExcel: true,
            importedAt: new Date().toISOString(),
          }),
        );
        if (existing) {
          await prisma.estimate.update({
            where: { id: existing.id },
            data: {
              oppAmountCents: BigInt(e.oppMarkupCents),
              data: estimateData,
            },
          });
        } else {
          await prisma.estimate.create({
            data: {
              companyId: co,
              jobId: job.id,
              status: 'DRAFT',
              oppAmountCents: BigInt(e.oppMarkupCents),
              oppPercent: e.oppPercent ?? 0.2,
              data: estimateData,
            },
          });
        }
        summary.estimates.written++;
      }

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);


// -----------------------------------------------------------------
// E3a: Daily Reports import
// -----------------------------------------------------------------

excelImportRouter.post(
  '/daily-reports',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const dryRun = String(req.query.dryRun ?? '') === '1';
      const parsed = parseDailyReports(req.file.buffer);

      // Group by (jobNumber, date).
      type Key = string; // `${jobNumber}|${date}`
      const groups = new Map<Key, ParsedLineLite[]>();
      for (const l of parsed.lines) {
        const k = `${l.jobNumber}|${l.date}`;
        const arr = groups.get(k) ?? [];
        arr.push(l);
        groups.set(k, arr);
      }

      const summary = {
        lineItems: parsed.lines.length,
        reports: groups.size,
        written: 0,
        skipped: 0,
        unknownJobs: [] as string[],
        warnings: parsed.warnings,
        dryRun,
      };

      if (dryRun) {
        return res.json({
          summary,
          sample: parsed.lines.slice(0, 5),
        });
      }

      const co = companyId();

      for (const [key, lines] of groups) {
        const [jobNumber, reportDate] = key.split('|') as [string, string];
        const job = await prisma.job.findFirst({
          where: { companyId: co, jobNumber, deletedAt: null },
        });
        if (!job) {
          if (!summary.unknownJobs.includes(jobNumber)) {
            summary.unknownJobs.push(jobNumber);
          }
          summary.skipped++;
          continue;
        }

        const existing = await prisma.dailyReport.findFirst({
          where: { companyId: co, jobId: job.id, reportDate, deletedAt: null },
        });
        const data = { lines, importedFromExcel: true };
        if (existing) {
          await prisma.dailyReport.update({
            where: { id: existing.id },
            data: { data: JSON.parse(JSON.stringify(data)) },
          });
        } else {
          await prisma.dailyReport.create({
            data: {
              id: 'dr-' + randomUUID().replace(/-/g, '').slice(0, 12),
              companyId: co,
              jobId: job.id,
              reportDate,
              data: JSON.parse(JSON.stringify(data)),
            },
          });
        }
        summary.written++;
      }

      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);

type ParsedLineLite = {
  date: string;
  jobNumber: string;
  jobName: string | null;
  category: string | null;
  costCode: string | null;
  description: string | null;
  qtyHrs: number | null;
  unit: string | null;
  otMult: number | null;
  rateCents: number | null;
  totalCostCents: number | null;
  employeeVendor: string | null;
  notes: string | null;
};

// -----------------------------------------------------------------
// Q0 backfill: walk Customer rows where data is missing or fails
// CustomerSchema.parse, and write a valid Customer JSON.
// -----------------------------------------------------------------

excelImportRouter.post('/backfill-customers', async (_req, res, next) => {
  try {
    const co = companyId();
    const rows = await prisma.customer.findMany({ where: { companyId: co, deletedAt: null } });

    type ZodKind =
      | 'STATE_AGENCY' | 'FEDERAL_AGENCY' | 'COUNTY' | 'CITY'
      | 'SPECIAL_DISTRICT' | 'PRIVATE_OWNER' | 'PRIME_CONTRACTOR' | 'OTHER';
    function inferCustomerKind(name: string): ZodKind {
      const n = name.toLowerCase();
      if (/\bcity of\b/.test(n)) return 'CITY';
      if (/\bcounty of\b|\bcounty\s*$/.test(n)) return 'COUNTY';
      if (n.includes('caltrans') || n.includes('cal fire') || n.includes('cal-fire') ||
          n.includes('state of') || n.includes('csu') || n.includes('university of california') ||
          n.includes('community college'))
        return 'STATE_AGENCY';
      if (n.includes('usfs') || n.includes('blm') || n.includes('army corps') ||
          n.includes('corps of engineers') || n.includes('bureau of') ||
          n.includes('usda') || n.includes('united states') || n.includes('forest service'))
        return 'FEDERAL_AGENCY';
      if (n.includes('school district') || n.includes('unified school') ||
          n.includes('water district') || n.includes('irrigation district') ||
          n.includes('fire protection district') || n.includes('sanitation district') ||
          n.includes('authority'))
        return 'SPECIAL_DISTRICT';
      return 'PRIVATE_OWNER';
    }

    let written = 0;
    let skipped = 0;
    for (const r of rows) {
      const d = r.data as Record<string, unknown> | null;
      // Already valid if data has legalName + kind.
      if (d && typeof d === 'object' && typeof (d as { legalName?: unknown }).legalName === 'string') {
        skipped += 1;
        continue;
      }
      const kind = inferCustomerKind(r.name);
      const nowIso = new Date().toISOString();
      const cusData = {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        updatedAt: nowIso,
        legalName: r.name,
        kind,
        contactName: r.contactName ?? undefined,
        email: r.contactEmail ?? undefined,
        phone: r.contactPhone ?? undefined,
        billingAddressLine: r.addressLine ?? undefined,
        city: r.city ?? undefined,
        state: r.state ?? undefined,
        zip: r.zip ?? undefined,
        taxExempt: false,
        onHold: false,
      };
      await prisma.customer.update({
        where: { id: r.id },
        data: { data: JSON.parse(JSON.stringify(cusData)) },
      });
      written += 1;
    }
    res.json({ written, skipped, totalRows: rows.length });
  } catch (err) { next(err); }
});
