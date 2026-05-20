// audit: CSV uploads log to request-id middleware; review with /admin/audit-log.
// Customer master routes.

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
import { prisma } from '@yge/db';
import {
  CustomerCreateSchema,
  CustomerPatchSchema,
  buildQboCustomerImport,
  customerKindLabel,
  customerRowsFromCsv,
  type Customer,
} from '@yge/shared';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '../lib/customers-store';
import { maybeCsv } from '../lib/csv-response';

export const customersRouter = Router();

const CUSTOMER_CSV_COLUMNS = [
  { header: 'Legal name', get: (c: Customer) => c.legalName },
  { header: 'DBA', get: (c: Customer) => c.dbaName ?? '' },
  { header: 'Kind', get: (c: Customer) => customerKindLabel(c.kind) },
  { header: 'Contact', get: (c: Customer) => c.contactName ?? '' },
  { header: 'Phone', get: (c: Customer) => c.phone ?? '' },
  { header: 'Email', get: (c: Customer) => c.email ?? '' },
  { header: 'City', get: (c: Customer) => c.city ?? '' },
  { header: 'State', get: (c: Customer) => c.state ?? '' },
  { header: 'Payment terms', get: (c: Customer) => c.paymentTerms ?? '' },
  { header: 'Tax exempt', get: (c: Customer) => (c.taxExempt ? 'Yes' : 'No') },
  { header: 'On hold', get: (c: Customer) => (c.onHold ? 'Yes' : 'No') },
] as const;

customersRouter.get('/', async (req, res, next) => {
  try {
    const customers = await listCustomers({
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });
    if (maybeCsv(req, res, customers, CUSTOMER_CSV_COLUMNS, 'customers')) return;
    return res.json({ customers });
  } catch (err) {
    next(err);
  }
});

customersRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const rows = await prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    // Count jobs per customer.
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const jobsByCustomer = new Map<string, number>();
    for (const j of jobs) {
      if (!j.customerId) continue;
      jobsByCustomer.set(j.customerId, (jobsByCustomer.get(j.customerId) ?? 0) + 1);
    }

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    const lines: string[] = [];
    lines.push('id,legalName,dbaName,kind,contactName,email,phone,billingAddressLine,city,state,zip,paymentTerms,taxExempt,onHold,jobsCount');
    for (const r of rows) {
      const d = (r.data as Record<string, unknown> | null) ?? {};
      lines.push([
        esc(r.id),
        esc(d.legalName ?? r.name),
        esc(d.dbaName ?? ''),
        esc(d.kind ?? r.type),
        esc(d.contactName ?? r.contactName ?? ''),
        esc(d.email ?? r.contactEmail ?? ''),
        esc(d.phone ?? r.contactPhone ?? ''),
        esc(d.billingAddressLine ?? r.addressLine ?? ''),
        esc(d.city ?? r.city ?? ''),
        esc(d.state ?? r.state ?? ''),
        esc(d.zip ?? r.zip ?? ''),
        esc(d.paymentTerms ?? ''),
        esc(d.taxExempt ?? false),
        esc(d.onHold ?? false),
        String(jobsByCustomer.get(r.id) ?? 0),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

customersRouter.post('/import-csv', upload.single('file'), async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? '') === '1';

    const text = req.file.buffer.toString('utf8');
    // Simple CSV parser (handles quoted fields containing commas).
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

    const rows = parseCsv(text);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty' });

    const header = (rows[0] ?? []).map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);
    const iLegalName = idx('legalName');
    const iKind = idx('kind');
    if (iLegalName < 0 || iKind < 0) {
      return res.status(400).json({ error: 'CSV must have legalName + kind columns' });
    }
    const iDbaName = idx('dbaName');
    const iContactName = idx('contactName');
    const iEmail = idx('email');
    const iPhone = idx('phone');
    const iAddr = idx('billingAddressLine');
    const iCity = idx('city');
    const iState = idx('state');
    const iZip = idx('zip');
    const iPaymentTerms = idx('paymentTerms');

    const valid = new Set([
      'STATE_AGENCY', 'FEDERAL_AGENCY', 'COUNTY', 'CITY',
      'SPECIAL_DISTRICT', 'PRIVATE_OWNER', 'PRIME_CONTRACTOR', 'OTHER',
    ]);
    const kindToType = (k: string) => {
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
    };

    const summary = {
      total: rows.length - 1,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; reason: string }>,
      dryRun,
    };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const legalName = (row[iLegalName] ?? '').trim();
      const kind = (row[iKind] ?? '').trim().toUpperCase();
      if (!legalName) {
        summary.errors.push({ row: r + 1, reason: 'legalName is empty' });
        summary.skipped++;
        continue;
      }
      if (!valid.has(kind)) {
        summary.errors.push({ row: r + 1, reason: `kind "${kind}" not in [${[...valid].join(',')}]` });
        summary.skipped++;
        continue;
      }
      const existing = await prisma.customer.findFirst({
        where: { companyId, name: { equals: legalName, mode: 'insensitive' }, deletedAt: null },
      });

      function cell(i: number): string | undefined {
        if (i < 0) return undefined;
        const v = (row[i] ?? '').trim();
        return v.length > 0 ? v : undefined;
      }

      const data = {
        legalName,
        kind,
        dbaName: cell(iDbaName),
        contactName: cell(iContactName),
        email: cell(iEmail),
        phone: cell(iPhone),
        billingAddressLine: cell(iAddr),
        city: cell(iCity),
        state: cell(iState),
        zip: cell(iZip),
        paymentTerms: cell(iPaymentTerms),
        taxExempt: false,
        onHold: false,
      };
      const prismaType = kindToType(kind) as 'PUBLIC_AGENCY' | 'UTILITY' | 'PRIVATE' | 'OTHER';

      if (dryRun) {
        if (existing) summary.updated++;
        else summary.created++;
        continue;
      }

      if (existing) {
        const merged = { ...((existing.data as object) ?? {}), ...data };
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: legalName,
            type: prismaType,
            contactName: data.contactName ?? null,
            contactEmail: data.email ?? null,
            contactPhone: data.phone ?? null,
            addressLine: data.billingAddressLine ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            zip: data.zip ?? null,
            data: JSON.parse(JSON.stringify({
              ...merged,
              id: existing.id,
              createdAt: existing.createdAt.toISOString(),
              updatedAt: new Date().toISOString(),
            })),
          },
        });
        summary.updated++;
      } else {
        const id = 'cus-' + Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
        const now = new Date().toISOString();
        await prisma.customer.create({
          data: {
            id,
            companyId,
            name: legalName,
            type: prismaType,
            contactName: data.contactName ?? null,
            contactEmail: data.email ?? null,
            contactPhone: data.phone ?? null,
            addressLine: data.billingAddressLine ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            zip: data.zip ?? null,
            data: JSON.parse(JSON.stringify({
              ...data,
              id,
              createdAt: now,
              updatedAt: now,
            })),
          },
        });
        summary.created++;
      }
    }

    res.json({ summary });
  } catch (err) { next(err); }
});

customersRouter.get('/revenue-concentration', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const customers = await prisma.customer.findMany({ where: { companyId, deletedAt: null } });
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const ies = await prisma.importedEstimate.findMany({ where: { companyId, deletedAt: null } });

    const bidPriceByJobId = new Map<string, number>();
    for (const ie of ies) {
      const d = ie.data as { jobId?: string; bidPriceCents?: number } | null;
      if (!d?.jobId || !d.bidPriceCents) continue;
      const prev = bidPriceByJobId.get(d.jobId) ?? 0;
      bidPriceByJobId.set(d.jobId, Math.max(prev, d.bidPriceCents));
    }

    let totalRev = 0;
    interface Row { id: string; name: string; revenueCents: number; jobsCount: number; sharePct: number }
    const rows: Row[] = customers.map((c) => {
      const myJobs = jobs.filter((j) =>
        j.customerId === c.id && (j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED'),
      );
      const rev = myJobs.reduce((sum, j) => sum + (bidPriceByJobId.get(j.id) ?? 0), 0);
      totalRev += rev;
      return { id: c.id, name: c.name, revenueCents: rev, jobsCount: myJobs.length, sharePct: 0 };
    });
    for (const r of rows) r.sharePct = totalRev > 0 ? r.revenueCents / totalRev : 0;
    rows.sort((a, b) => b.revenueCents - a.revenueCents);

    // HHI: sum of squared market shares ×10,000.
    const hhi = Math.round(rows.reduce((acc, r) => acc + Math.pow(r.sharePct * 100, 2), 0));

    res.json({
      rows: rows.filter((r) => r.revenueCents > 0),
      totalRevenueCents: totalRev,
      hhi,
      hhiClass: hhi > 2500 ? 'concentrated' : hhi > 1500 ? 'moderate' : 'competitive',
    });
  } catch (err) { next(err); }
});

customersRouter.get('/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (q.length < 1) return res.json({ matches: [] });
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const all = await prisma.customer.findMany({ where: { companyId, deletedAt: null } });
    const matches = all
      .filter((c) => c.name.toLowerCase().includes(q) || (c.contactName ?? '').toLowerCase().includes(q) || (c.contactEmail ?? '').toLowerCase().includes(q))
      .slice(0, 50)
      .map((c) => ({ id: c.id, name: c.name, type: c.type, contactName: c.contactName, contactEmail: c.contactEmail }));
    res.json({ q, matches });
  } catch (err) { next(err); }
});

customersRouter.get('/email-list', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const customers = await prisma.customer.findMany({
      where: { companyId, deletedAt: null, contactEmail: { not: null } },
      orderBy: { name: 'asc' },
    });
    const emails = customers
      .map((c) => ({ name: c.name, email: c.contactEmail!, contactName: c.contactName }))
      .filter((c) => c.email && c.email.includes('@'));
    res.json({
      total: emails.length,
      emails,
      bcc: emails.map((e) => e.email).join(', '),
    });
  } catch (err) { next(err); }
});

customersRouter.get('/touchpoints', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const customers = await prisma.customer.findMany({ where: { companyId, deletedAt: null } });
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const ies = await prisma.importedEstimate.findMany({ where: { companyId, deletedAt: null } });
    const results = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null } });

    const ownerByJobId = new Map<string, string | null>();
    for (const j of jobs) ownerByJobId.set(j.id, j.customerId ?? null);

    const now = Date.now();
    interface Row {
      id: string;
      name: string;
      jobsCount: number;
      lastJobAt: string | null;
      lastEstimateAt: string | null;
      lastBidAt: string | null;
      daysSinceContact: number | null;
    }
    const rows: Row[] = [];

    for (const c of customers) {
      const myJobs = jobs.filter((j) => j.customerId === c.id);
      const jobIds = new Set(myJobs.map((j) => j.id));
      const myEsts = ies.filter((e) => {
        const d = e.data as { jobId?: string } | null;
        return d?.jobId && jobIds.has(d.jobId);
      });
      const myResults = results.filter((r) => {
        const d = r.data as { jobId?: string } | null;
        return d?.jobId && jobIds.has(d.jobId);
      });
      const lastJobAt = myJobs.length > 0
        ? myJobs.map((j) => j.updatedAt.getTime()).sort((a, b) => b - a)[0] ?? null
        : null;
      const lastEstimateAt = myEsts.length > 0
        ? myEsts.map((e) => e.updatedAt.getTime()).sort((a, b) => b - a)[0] ?? null
        : null;
      const lastBidAt = myResults.length > 0
        ? myResults.map((r) => r.updatedAt.getTime()).sort((a, b) => b - a)[0] ?? null
        : null;
      const lastContact = Math.max(lastJobAt ?? 0, lastEstimateAt ?? 0, lastBidAt ?? 0);
      rows.push({
        id: c.id,
        name: c.name,
        jobsCount: myJobs.length,
        lastJobAt: lastJobAt ? new Date(lastJobAt).toISOString() : null,
        lastEstimateAt: lastEstimateAt ? new Date(lastEstimateAt).toISOString() : null,
        lastBidAt: lastBidAt ? new Date(lastBidAt).toISOString() : null,
        daysSinceContact: lastContact > 0 ? Math.floor((now - lastContact) / 86400000) : null,
      });
    }

    rows.sort((a, b) => {
      const ad = a.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
      const bd = b.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
      return bd - ad;
    });
    res.json({ rows });
  } catch (err) { next(err); }
});

// 1738: rollup is comprehensive (jobs, estimates, bid stats, revenue).
customersRouter.get('/:id/rollup', async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const cusId = req.params.id;

    const jobs = await prisma.job.findMany({
      where: { companyId, customerId: cusId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const jobIds = jobs.map((j) => j.id);

    const ies = await prisma.importedEstimate.findMany({
      where: { companyId, deletedAt: null },
    });
    const linkedEstimates = ies.filter((ie) => {
      const d = ie.data as { jobId?: string } | null;
      return d?.jobId && jobIds.includes(d.jobId);
    });

    const results = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null } });
    const myResults = results.filter((r) => {
      const d = r.data as { jobId?: string } | null;
      return d?.jobId && jobIds.includes(d.jobId);
    });

    let won = 0;
    let lost = 0;
    let tbd = 0;
    let noAward = 0;
    for (const r of myResults) {
      const d = r.data as { outcome?: string } | null;
      switch (d?.outcome) {
        case 'WON_BY_YGE': won += 1; break;
        case 'WON_BY_OTHER': lost += 1; break;
        case 'NO_AWARD': noAward += 1; break;
        default: tbd += 1;
      }
    }
    const total = myResults.length;
    const winRate = total > 0 ? won / total : 0;

    // Revenue: sum of bidPriceCents on imported estimates linked to AWARDED jobs.
    let revenueCents = 0;
    for (const ie of linkedEstimates) {
      const d = ie.data as { jobId?: string; bidPriceCents?: number } | null;
      if (!d?.jobId || !d.bidPriceCents) continue;
      const j = jobs.find((jj) => jj.id === d.jobId);
      if (j && (j.status === 'AWARDED' || j.status === 'ACTIVE' || j.status === 'CLOSED')) {
        revenueCents += d.bidPriceCents;
      }
    }

    res.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      })),
      importedEstimates: linkedEstimates.map((ie) => {
        const d = ie.data as { projectName?: string; jobId?: string; bidPriceCents?: number; directCostCents?: number } | null;
        return {
          id: ie.id,
          jobNumber: ie.jobNumber,
          projectName: d?.projectName ?? '',
          jobId: d?.jobId ?? null,
          bidPriceCents: d?.bidPriceCents ?? 0,
          directCostCents: d?.directCostCents ?? 0,
        };
      }),
      bidStats: { total, won, lost, noAward, tbd, winRate },
      revenueCents,
    });
  } catch (err) { next(err); }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getCustomer(req.params.id);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ customer: c });
  } catch (err) {
    next(err);
  }
});

customersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CustomerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createCustomer(parsed.data);
    return res.status(201).json({ customer: c });
  } catch (err) {
    next(err);
  }
});

customersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CustomerPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCustomer(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ customer: updated });
  } catch (err) {
    next(err);
  }
});


/** QuickBooks Online customer import.
 *
 *  Body: { csv: string, dryRun?: boolean }. Dry run (default) returns the
 *  full plan without writing; dryRun:false commits. Idempotent: any
 *  customer whose legal name already exists (case-insensitive) is skipped,
 *  so re-running never duplicates. */
const QboCustomerImportBody = z.object({
  csv: z.string().min(1).max(5_000_000),
  dryRun: z.boolean().optional(),
});

customersRouter.post('/import-qbo', async (req, res, next) => {
  try {
    const parsed = QboCustomerImportBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { csv, dryRun = true } = parsed.data;

    const rows = customerRowsFromCsv(csv);
    const plan = buildQboCustomerImport(rows);

    const existing = await listCustomers();
    const haveNames = new Set(existing.map((c) => c.legalName.trim().toLowerCase()));

    const toCreate = plan.customers.filter(
      (c) => !haveNames.has(c.legalName.trim().toLowerCase()),
    );
    const skipped = plan.customers.filter((c) =>
      haveNames.has(c.legalName.trim().toLowerCase()),
    );

    const summary = {
      parsedRows: rows.length,
      mapped: plan.customers.length,
      willCreate: toCreate.length,
      willSkip: skipped.length,
      warnings: plan.warnings.length,
    };

    if (dryRun) {
      return res.json({
        dryRun: true,
        summary,
        plan,
        skipped: skipped.map((c) => ({ legalName: c.legalName })),
      });
    }

    const created: Array<{ legalName: string; kind: string }> = [];
    for (const c of toCreate) {
      const { sourceName: _sourceName, ...customerCreate } = c;
      void _sourceName;
      const saved = await createCustomer(customerCreate);
      created.push({ legalName: saved.legalName, kind: saved.kind });
    }

    return res.status(201).json({
      dryRun: false,
      summary: { ...summary, created: created.length },
      created,
      skipped: skipped.map((c) => ({ legalName: c.legalName })),
      warnings: plan.warnings,
    });
  } catch (err) {
    next(err);
  }
});
