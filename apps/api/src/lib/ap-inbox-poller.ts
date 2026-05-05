// AP inbox poller — pulls vendor invoices out of a shared Outlook
// mailbox (default: ap@youngge.com) and turns each one into a draft
// AP invoice in the YGE app.
//
// Plain English: vendors email invoices to ap@. This walks the latest
// messages in that mailbox, downloads any PDF attachments to the API's
// persistent disk, and creates a DRAFT AP invoice row pre-filled with
// the sender as the vendor name, the subject + first 500 chars of body
// in notes, and the attachment path stashed in notes for now (the AI
// line-item extractor lands in a later bundle). Already-processed
// messages are tracked in data/ap-inbox/ingested.json so subsequent
// polls don't double-import.
//
// Shared-mailbox access: the calling user (Ryan) needs Graph
// permission to read the shared mailbox. Mail.Read on the user is
// sufficient for shared mailboxes the user has been delegated to —
// we set up that delegation when ap@youngge.com was created.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { graphGet, graphGetBinary } from './microsoft-graph';
import { createApInvoice } from './ap-invoices-store';
import type { AuditContext } from './audit-store';
import {
  extractInvoiceFromPdf,
  type ExtractedInvoice,
} from './ap-invoice-extractor';

interface MessageEmailAddress {
  emailAddress?: { name?: string; address?: string };
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: MessageEmailAddress;
  receivedDateTime?: string;
  bodyPreview?: string;
  hasAttachments?: boolean;
  webLink?: string;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  '@odata.type': string;
}

interface PollResult {
  scanned: number;
  ingested: number;
  skipped: number;
  /** Number of invoices where AI extraction succeeded (vs. blank-draft fallback). */
  extracted: number;
  newInvoices: {
    id: string;
    vendorName: string;
    subject: string;
    aiExtracted: boolean;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

function inboxDir(): string {
  return (
    process.env.AP_INBOX_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'ap-inbox')
  );
}

function ingestedIndexPath(): string {
  return path.join(inboxDir(), 'ingested.json');
}

async function readIngestedIds(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(ingestedIndexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw err;
  }
}

async function writeIngestedIds(ids: Set<string>): Promise<void> {
  await fs.mkdir(inboxDir(), { recursive: true });
  // Cap the index to the most recent 5000 ids so the file doesn't
  // grow forever. Older messages will not get re-ingested because
  // Graph's recent-messages window is shorter than that.
  const arr = [...ids].slice(-5000);
  await fs.writeFile(ingestedIndexPath(), JSON.stringify(arr, null, 2), 'utf8');
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function senderName(msg: GraphMessage): string {
  const ea = msg.from?.emailAddress;
  return (ea?.name?.trim() || ea?.address?.trim() || 'Unknown vendor').slice(0, 200);
}

export interface PollOptions {
  /** YGE user whose Microsoft tokens we use to call Graph. Must be a
   *  user delegated access to the shared mailbox. */
  userEmail: string;
  /** Shared mailbox to read. Default ap@youngge.com. */
  mailbox?: string;
  /** How many recent messages to look at. Default 25. */
  limit?: number;
  ctx?: AuditContext;
}

export async function pollApInbox(opts: PollOptions): Promise<PollResult> {
  const mailbox = opts.mailbox ?? 'ap@youngge.com';
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  await fs.mkdir(inboxDir(), { recursive: true });
  const seen = await readIngestedIds();
  const result: PollResult = {
    scanned: 0,
    ingested: 0,
    skipped: 0,
    extracted: 0,
    newInvoices: [],
  };

  // Fetch recent messages from the shared mailbox.
  const listUrl =
    `/users/${encodeURIComponent(mailbox)}/messages` +
    `?$top=${limit}` +
    `&$orderby=receivedDateTime desc` +
    `&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments,webLink`;
  const listed = await graphGet<{ value: GraphMessage[] }>(opts.userEmail, listUrl);

  for (const msg of listed.value) {
    result.scanned++;
    if (seen.has(msg.id)) {
      result.skipped++;
      continue;
    }

    // Download any PDF attachments before creating the invoice so
    // they're already on disk by the time the row exists. Also keep
    // the bytes around so we can hand them straight to the AI
    // extractor without re-reading from disk.
    let savedAttachmentPath: string | null = null;
    let pdfBytes: Buffer | null = null;
    if (msg.hasAttachments) {
      try {
        const attRes = await graphGet<{ value: GraphAttachment[] }>(
          opts.userEmail,
          `/users/${encodeURIComponent(mailbox)}/messages/${msg.id}/attachments` +
            `?$select=id,name,contentType,size`,
        );
        const pdf = attRes.value.find((a) =>
          /pdf/i.test(a.contentType ?? '') || /\.pdf$/i.test(a.name ?? ''),
        );
        if (pdf) {
          const bin = await graphGetBinary(
            opts.userEmail,
            `/users/${encodeURIComponent(mailbox)}/messages/${msg.id}/attachments/${pdf.id}/$value`,
          );
          const fname = `${msg.id.slice(-12)}-${safeFilename(pdf.name)}`;
          savedAttachmentPath = path.join(inboxDir(), fname);
          await fs.writeFile(savedAttachmentPath, bin.bytes);
          pdfBytes = bin.bytes;
        }
      } catch {
        // Don't let an attachment failure block the row creation —
        // the user can refetch from the email's webLink.
      }
    }

    // Try AI extraction on the PDF. Failure leaves `extracted` null
    // and we fall back to a minimal draft.
    let extracted: ExtractedInvoice | null = null;
    if (pdfBytes) {
      extracted = await extractInvoiceFromPdf(pdfBytes);
    }

    const senderVendor = senderName(msg);
    const subject = (msg.subject ?? '(no subject)').slice(0, 200);
    const noteParts = [
      extracted
        ? `AI extraction (${extracted.promptVersion}, confidence ${extracted.confidence})`
        : 'AI extraction not run (no PDF found or extractor unavailable).',
      extracted?.extractionNotes
        ? `Reviewer note: ${extracted.extractionNotes}`
        : null,
      `From: ${senderVendor}`,
      msg.receivedDateTime ? `Received: ${msg.receivedDateTime}` : null,
      msg.subject ? `Subject: ${msg.subject}` : null,
      savedAttachmentPath
        ? `Attachment saved at: ${savedAttachmentPath}`
        : 'No PDF attachment found.',
      msg.webLink ? `Open in Outlook: ${msg.webLink}` : null,
      msg.bodyPreview ? `\nPreview:\n${msg.bodyPreview.slice(0, 500)}` : null,
    ].filter((s): s is string => s !== null);

    // Build the create payload — extracted values win over fallbacks.
    const vendor = extracted?.vendorName ?? senderVendor;
    const invoiceDate = extracted?.invoiceDate ?? todayIso();
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
        invoiceDate,
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
      opts.ctx,
    );

    seen.add(msg.id);
    result.ingested++;
    if (extracted) result.extracted++;
    result.newInvoices.push({
      id: invoice.id,
      vendorName: vendor,
      subject,
      aiExtracted: extracted !== null,
      ...(extracted ? { confidence: extracted.confidence } : {}),
    });
  }

  if (result.ingested > 0) await writeIngestedIds(seen);
  return result;
}
