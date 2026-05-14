// Customer master routes.

import { Router } from 'express';
import { prisma } from '@yge/db';
import {
  CustomerCreateSchema,
  CustomerPatchSchema,
  customerKindLabel,
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
