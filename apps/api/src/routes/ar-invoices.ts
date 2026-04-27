// AR invoice routes — outgoing customer/agency bills.

import { Router } from 'express';
import {
  ArInvoiceBuildFromReportsSchema,
  ArInvoiceCreateSchema,
  ArInvoicePatchSchema,
  computeArTotals,
} from '@yge/shared';
import {
  createArInvoice,
  getArInvoice,
  listArInvoices,
  updateArInvoice,
} from '../lib/ar-invoices-store';
import { listDailyReports } from '../lib/daily-reports-store';
import { listEmployees } from '../lib/employees-store';
import { buildArLineItemsFromReports } from '../lib/ar-build-from-reports';

export const arInvoicesRouter = Router();

arInvoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoices = await listArInvoices({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

arInvoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const inv = await getArInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

arInvoicesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ArInvoiceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const inv = await createArInvoice(parsed.data);
    return res.status(201).json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

arInvoicesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ArInvoicePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    let body = parsed.data;
    // If line items / tax / retention changed, re-compute totals so the
    // header stays in sync with the lines.
    if (body.lineItems !== undefined || body.taxCents !== undefined || body.retentionCents !== undefined) {
      const existing = await getArInvoice(req.params.id);
      if (existing) {
        const merged = { ...existing, ...body };
        const totals = computeArTotals(merged);
        body = { ...body, subtotalCents: totals.subtotalCents, totalCents: totals.totalCents };
      }
    }
    const updated = await updateArInvoice(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/ar-invoices/:id/build-from-daily-reports — aggregate daily
// reports for the period and write the resulting line items onto the
// invoice.
arInvoicesRouter.post('/:id/build-from-daily-reports', async (req, res, next) => {
  try {
    const parsed = ArInvoiceBuildFromReportsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const existing = await getArInvoice(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const [reports, employees] = await Promise.all([
      listDailyReports({ jobId: existing.jobId }),
      listEmployees(),
    ]);
    const built = buildArLineItemsFromReports(reports, employees, existing.jobId, parsed.data);
    const totals = computeArTotals({
      lineItems: built.lineItems,
      taxCents: existing.taxCents,
      retentionCents: existing.retentionCents,
    });

    const updated = await updateArInvoice(req.params.id, {
      source: 'DAILY_REPORTS',
      lineItems: built.lineItems,
      billingPeriodStart: parsed.data.start,
      billingPeriodEnd: parsed.data.end,
      subtotalCents: totals.subtotalCents,
      totalCents: totals.totalCents,
    });
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({
      invoice: updated,
      built: {
        reportsConsulted: built.reportsConsulted,
        unsubmittedReportsSkipped: built.unsubmittedReportsSkipped,
        hoursPerClassification: built.hoursPerClassification,
      },
    });
  } catch (err) {
    next(err);
  }
});
