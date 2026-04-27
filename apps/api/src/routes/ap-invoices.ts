// AP invoice routes — vendor bills.

import { Router } from 'express';
import {
  ApInvoiceApproveSchema,
  ApInvoiceCreateSchema,
  ApInvoicePatchSchema,
  ApInvoicePaySchema,
  ApInvoiceRejectSchema,
  csvDollars,
  type ApInvoice,
} from '@yge/shared';
import {
  approveApInvoice,
  createApInvoice,
  getApInvoice,
  listApInvoices,
  payApInvoice,
  rejectApInvoice,
  updateApInvoice,
} from '../lib/ap-invoices-store';
import { maybeCsv } from '../lib/csv-response';

export const apInvoicesRouter = Router();

const AP_INVOICE_CSV_COLUMNS = [
  { header: 'Vendor', get: (i: ApInvoice) => i.vendorName },
  { header: 'Invoice #', get: (i: ApInvoice) => i.invoiceNumber ?? '' },
  { header: 'Date', get: (i: ApInvoice) => i.invoiceDate },
  { header: 'Due', get: (i: ApInvoice) => i.dueDate ?? '' },
  { header: 'Job', get: (i: ApInvoice) => i.jobId ?? '' },
  { header: 'Status', get: (i: ApInvoice) => i.status },
  { header: 'Subtotal', get: (i: ApInvoice) => csvDollars(i.subtotalCents ?? 0) },
  { header: 'Tax', get: (i: ApInvoice) => csvDollars(i.taxCents ?? 0) },
  { header: 'Freight', get: (i: ApInvoice) => csvDollars(i.freightCents ?? 0) },
  { header: 'Total', get: (i: ApInvoice) => csvDollars(i.totalCents) },
  { header: 'Paid', get: (i: ApInvoice) => csvDollars(i.paidCents) },
  {
    header: 'Balance',
    get: (i: ApInvoice) => csvDollars(Math.max(0, i.totalCents - i.paidCents)),
  },
] as const;

apInvoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoices = await listApInvoices({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    if (maybeCsv(req, res, invoices, AP_INVOICE_CSV_COLUMNS, 'ap-invoices')) return;
    return res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const inv = await getApInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ApInvoiceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const inv = await createApInvoice(parsed.data);
    return res.status(201).json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ApInvoicePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateApInvoice(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const parsed = ApInvoiceApproveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await approveApInvoice(
      req.params.id,
      parsed.data.approvedByEmployeeId,
    );
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/pay', async (req, res, next) => {
  try {
    const parsed = ApInvoicePaySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await payApInvoice(
      req.params.id,
      parsed.data.paidAt,
      parsed.data.paymentMethod,
      parsed.data.paymentReference,
      parsed.data.amountCents,
    );
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const parsed = ApInvoiceRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await rejectApInvoice(req.params.id, parsed.data.reason);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});
