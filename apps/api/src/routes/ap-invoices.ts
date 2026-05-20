import { z } from 'zod';
// AP invoice routes — vendor bills.

import { Router } from 'express';
import {
  ApInvoiceApproveSchema,
  ApInvoiceCreateSchema,
  ApInvoicePatchSchema,
  ApInvoicePaySchema,
  ApInvoiceRejectSchema,
  apRowsFromCsv,
  buildQboApImport,
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
import { graphGet, graphGetBinary, isMicrosoftConfigured } from '../lib/microsoft-graph';
import { extractInvoiceFromPdf } from '../lib/ap-invoice-extractor';

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

// POST /api/ap-invoices/draft-from-email — one-click convert an
// inbox-triage VENDOR_BILL email into a DRAFT AP invoice. Pulls
// the email body + PDF attachments via Microsoft Graph, runs the
// existing AI extractor on the PDF (if present), creates the draft.
//
// Request body: { email, messageId }
// Response: { invoice }
apInvoicesRouter.post('/draft-from-email', async (req, res, next) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft Graph not configured' });
    }
    const Body = z.object({
      email: z.string().email(),
      messageId: z.string().min(1).max(500),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { email, messageId } = parsed.data;

    // Fetch the message metadata.
    interface GraphMsg {
      id: string;
      subject?: string;
      bodyPreview?: string;
      receivedDateTime?: string;
      hasAttachments?: boolean;
      webLink?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
    }
    const msg = await graphGet<GraphMsg>(
      email,
      `/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,bodyPreview,receivedDateTime,hasAttachments,webLink,from`,
    );

    // Fetch + scan attachments for the first PDF.
    interface GraphAttachment {
      id: string;
      name: string;
      contentType: string;
      size: number;
      '@odata.type': string;
    }
    let pdfBytes: Buffer | null = null;
    let pdfName: string | null = null;
    if (msg.hasAttachments) {
      try {
        const list = await graphGet<{ value: GraphAttachment[] }>(
          email,
          `/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size`,
        );
        const pdf = list.value.find(
          (a) =>
            a.contentType?.toLowerCase().includes('pdf') ||
            a.name?.toLowerCase().endsWith('.pdf'),
        );
        if (pdf) {
          const bin = await graphGetBinary(
            email,
            `/me/messages/${encodeURIComponent(messageId)}/attachments/${pdf.id}/$value`,
          );
          pdfBytes = Buffer.from(bin.bytes);
          pdfName = pdf.name;
        }
      } catch {
        // Don't let an attachment failure block the draft.
      }
    }

    // Run AI extraction on the PDF if we got one.
    let extracted: Awaited<ReturnType<typeof extractInvoiceFromPdf>> = null;
    if (pdfBytes) {
      extracted = await extractInvoiceFromPdf(pdfBytes);
    }

    const senderVendor =
      msg.from?.emailAddress?.name ??
      msg.from?.emailAddress?.address ??
      'Unknown vendor';
    const subject = (msg.subject ?? '(no subject)').slice(0, 200);
    const todayIso = new Date().toISOString().slice(0, 10);

    const noteParts = [
      extracted
        ? `AI extraction (${extracted.promptVersion}, confidence ${extracted.confidence})`
        : pdfBytes
          ? 'AI extraction failed — review attachment manually.'
          : 'No PDF attachment found in this email.',
      extracted?.extractionNotes ? `Reviewer note: ${extracted.extractionNotes}` : null,
      `From: ${senderVendor}`,
      msg.receivedDateTime ? `Received: ${msg.receivedDateTime}` : null,
      msg.subject ? `Subject: ${msg.subject}` : null,
      pdfName ? `Attachment: ${pdfName}` : null,
      msg.webLink ? `Open in Outlook: ${msg.webLink}` : null,
      msg.bodyPreview ? `\nPreview:\n${msg.bodyPreview.slice(0, 500)}` : null,
    ].filter((x): x is string => x !== null);

    const vendor = extracted?.vendorName ?? senderVendor;
    const lineItems = (extracted?.lineItems ?? []).map((li) => ({
      description: li.description,
      ...(li.unit ? { unit: li.unit } : {}),
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      lineTotalCents: li.lineTotalCents,
    }));

    const invoice = await createApInvoice(
      {
        vendorName: vendor,
        ...(extracted?.invoiceNumber ? { invoiceNumber: extracted.invoiceNumber } : {}),
        invoiceDate: extracted?.invoiceDate ?? todayIso,
        ...(extracted?.dueDate ? { dueDate: extracted.dueDate } : {}),
        ...(extracted?.subtotalCents !== undefined
          ? { subtotalCents: extracted.subtotalCents }
          : {}),
        ...(extracted?.taxCents !== undefined ? { taxCents: extracted.taxCents } : {}),
        ...(extracted?.freightCents !== undefined
          ? { freightCents: extracted.freightCents }
          : {}),
        ...(extracted?.totalCents !== undefined
          ? { totalCents: extracted.totalCents }
          : {}),
        lineItems,
        status: 'DRAFT',
        notes: noteParts.join('\n'),
      },
      // No audit ctx — the human review will record the eventual approval.
    );

    res.json({
      invoice,
      aiExtracted: extracted !== null,
      ...(extracted ? { confidence: extracted.confidence } : {}),
    });
  } catch (err) {
    next(err);
  }
});


/** QuickBooks Online open A/P import. Body: { csv, dryRun? }. Dry run
 *  (default) previews; dryRun:false commits. Idempotent: skips any bill
 *  whose (vendor + bill number) — or (vendor + date + amount) when there is
 *  no number — already exists. */
const QboApImportBody = z.object({
  csv: z.string().min(1).max(5_000_000),
  dryRun: z.boolean().optional(),
});

function apDedupKey(vendorName: string, invoiceNumber: string | undefined, invoiceDate: string, totalCents: number): string {
  const tail = invoiceNumber && invoiceNumber.length > 0
    ? invoiceNumber.toLowerCase()
    : `${invoiceDate}|${totalCents}`;
  return `${vendorName.trim().toLowerCase()}::${tail}`;
}

apInvoicesRouter.post('/import-qbo', async (req, res, next) => {
  try {
    const parsed = QboApImportBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { csv, dryRun = true } = parsed.data;

    const rows = apRowsFromCsv(csv);
    const plan = buildQboApImport(rows);

    const existing = await listApInvoices();
    const have = new Set(
      existing.map((b) => apDedupKey(b.vendorName, b.invoiceNumber, b.invoiceDate, b.totalCents)),
    );

    const toCreate = plan.bills.filter(
      (b) => !have.has(apDedupKey(b.vendorName, b.invoiceNumber, b.invoiceDate, b.totalCents ?? 0)),
    );
    const skipped = plan.bills.filter((b) =>
      have.has(apDedupKey(b.vendorName, b.invoiceNumber, b.invoiceDate, b.totalCents ?? 0)),
    );

    const summary = {
      parsedRows: rows.length,
      mapped: plan.bills.length,
      willCreate: toCreate.length,
      willSkip: skipped.length,
      warnings: plan.warnings.length,
      totalOpenCents: plan.totalOpenCents,
    };

    if (dryRun) {
      return res.json({
        dryRun: true,
        summary,
        plan,
        skipped: skipped.map((b) => ({ vendorName: b.vendorName, invoiceNumber: b.invoiceNumber ?? null })),
      });
    }

    const created: Array<{ vendorName: string; totalCents: number }> = [];
    for (const b of toCreate) {
      const { sourceVendor: _sourceVendor, ...billCreate } = b;
      void _sourceVendor;
      const saved = await createApInvoice(billCreate);
      created.push({ vendorName: saved.vendorName, totalCents: saved.totalCents });
    }

    return res.status(201).json({
      dryRun: false,
      summary: { ...summary, created: created.length },
      created,
      skipped: skipped.map((b) => ({ vendorName: b.vendorName, invoiceNumber: b.invoiceNumber ?? null })),
      warnings: plan.warnings,
    });
  } catch (err) {
    next(err);
  }
});
