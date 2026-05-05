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

// POST /api/ap-invoices/:id/re-extract — re-runs the AI extractor on
// the saved attachment PDF and PATCHes the invoice with the result.
// Useful when the auto-poll's first pass failed (transient Claude
// outage, missing API key at the time, etc.) — the AP clerk clicks
// this to retry without re-pulling from email.
apInvoicesRouter.post('/:id/re-extract', async (req, res, next) => {
  try {
    const inv = await getApInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const match = (inv.notes ?? '').match(/Attachment saved at:\s*(.+)/i);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      return res
        .status(400)
        .json({ error: 'No saved attachment to re-extract from.' });
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const inboxRoot = path.resolve(
      process.env.AP_INBOX_DATA_DIR ??
        path.resolve(process.cwd(), 'data', 'ap-inbox'),
    );
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(inboxRoot + path.sep) && resolved !== inboxRoot) {
      return res.status(403).json({ error: 'Attachment outside inbox dir' });
    }
    const bytes = await fs.readFile(resolved).catch(() => null);
    if (!bytes) {
      return res.status(404).json({ error: 'Attachment file missing on disk' });
    }
    const { extractInvoiceFromPdf } = await import('../lib/ap-invoice-extractor');
    const extracted = await extractInvoiceFromPdf(bytes);
    if (!extracted) {
      return res.status(502).json({
        error: 'Extraction failed (Anthropic call errored or returned no tool call).',
      });
    }
    // Build the patch — extracted values overwrite the existing row,
    // but we keep the audit trail visible by appending a re-extract
    // marker to notes.
    const newNotesPrefix = `Re-extracted ${new Date().toISOString()} (${extracted.promptVersion}, confidence ${extracted.confidence})`;
    const oldNotes = (inv.notes ?? '').trim();
    const patch: Record<string, unknown> = {
      vendorName: extracted.vendorName,
      ...(extracted.invoiceNumber ? { invoiceNumber: extracted.invoiceNumber } : {}),
      ...(extracted.invoiceDate ? { invoiceDate: extracted.invoiceDate } : {}),
      ...(extracted.dueDate ? { dueDate: extracted.dueDate } : {}),
      ...(extracted.subtotalCents !== undefined
        ? { subtotalCents: extracted.subtotalCents }
        : {}),
      ...(extracted.taxCents !== undefined ? { taxCents: extracted.taxCents } : {}),
      ...(extracted.freightCents !== undefined
        ? { freightCents: extracted.freightCents }
        : {}),
      totalCents: extracted.totalCents,
      lineItems: extracted.lineItems.map((li) => ({
        description: li.description,
        ...(li.unit ? { unit: li.unit } : {}),
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        lineTotalCents: li.lineTotalCents,
      })),
      notes: [newNotesPrefix, oldNotes].filter(Boolean).join('\n\n'),
    };
    const updated = await updateApInvoice(req.params.id, patch);
    return res.json({ invoice: updated, extracted });
  } catch (err) {
    next(err);
  }
});

// GET /api/ap-invoices/:id/attachment — streams the PDF that the AP
// inbox poller saved alongside the row. The poller stores the path
// in `notes` ("Attachment saved at: <abs path>") so the office can
// view the original invoice while transcribing line items. We
// constrain the served path to the AP inbox directory to avoid
// directory-traversal exposure.
apInvoicesRouter.get('/:id/attachment', async (req, res, next) => {
  try {
    const inv = await getApInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const match = (inv.notes ?? '').match(/Attachment saved at:\s*(.+)/i);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      return res.status(404).json({ error: 'No attachment for this invoice' });
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const inboxRoot = path.resolve(
      process.env.AP_INBOX_DATA_DIR ??
        path.resolve(process.cwd(), 'data', 'ap-inbox'),
    );
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(inboxRoot + path.sep) && resolved !== inboxRoot) {
      return res.status(403).json({ error: 'Attachment outside inbox dir' });
    }
    const bytes = await fs.readFile(resolved).catch(() => null);
    if (!bytes) {
      return res.status(404).json({ error: 'Attachment file missing' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(resolved).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    );
    return res.end(bytes);
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
