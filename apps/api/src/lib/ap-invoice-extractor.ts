// AP invoice extractor — pulls structured data out of a vendor PDF
// using Claude vision + the v1 ap-invoice-extract prompt.
//
// Plain English: the AP inbox poller hands us a PDF that just landed
// in ap@youngge.com. This calls Anthropic Claude with that PDF and
// the extraction prompt, returns vendor / invoice number / dates /
// line items / totals — or null if extraction failed for any reason
// (we never block the invoice draft creation on extractor errors).

import { anthropic, DEFAULT_MODEL } from './anthropic';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  TOOL,
} from './prompts/ap-invoice-extract-v1';

interface RawLineItem {
  description?: unknown;
  unit?: unknown;
  quantity?: unknown;
  unit_price_cents?: unknown;
  line_total_cents?: unknown;
}

interface RawExtraction {
  vendor_name?: unknown;
  invoice_number?: unknown;
  invoice_date?: unknown;
  due_date?: unknown;
  subtotal_cents?: unknown;
  tax_cents?: unknown;
  freight_cents?: unknown;
  total_cents?: unknown;
  job_number?: unknown;
  line_items?: unknown;
  confidence?: unknown;
  extraction_notes?: unknown;
}

export interface ExtractedLine {
  description: string;
  unit?: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface ExtractedInvoice {
  vendorName: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotalCents?: number;
  taxCents?: number;
  freightCents?: number;
  totalCents: number;
  jobNumber?: string;
  lineItems: ExtractedLine[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  extractionNotes?: string;
  promptVersion: string;
  modelUsed: string;
}

function s(v: unknown, max = 400): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}
function intCents(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.round(v));
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function isoDate(v: unknown): string | undefined {
  const str = s(v, 20);
  if (!str) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : undefined;
}
function confidence(v: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
  return 'LOW';
}

function shape(raw: RawExtraction): ExtractedInvoice {
  const linesRaw = Array.isArray(raw.line_items) ? (raw.line_items as RawLineItem[]) : [];
  const lineItems: ExtractedLine[] = [];
  for (const li of linesRaw) {
    const desc = s(li.description, 400);
    const total = intCents(li.line_total_cents);
    if (!desc || total === undefined) continue;
    const qty = num(li.quantity) || 1;
    const unit = s(li.unit, 20);
    const unitPrice = intCents(li.unit_price_cents) ?? Math.round(total / Math.max(qty, 1));
    lineItems.push({
      description: desc,
      ...(unit ? { unit } : {}),
      quantity: qty,
      unitPriceCents: unitPrice,
      lineTotalCents: total,
    });
  }

  const total = intCents(raw.total_cents) ?? 0;
  return {
    vendorName: s(raw.vendor_name, 200) ?? 'Unknown vendor',
    ...(s(raw.invoice_number, 80) ? { invoiceNumber: s(raw.invoice_number, 80)! } : {}),
    ...(isoDate(raw.invoice_date) ? { invoiceDate: isoDate(raw.invoice_date)! } : {}),
    ...(isoDate(raw.due_date) ? { dueDate: isoDate(raw.due_date)! } : {}),
    ...(intCents(raw.subtotal_cents) !== undefined ? { subtotalCents: intCents(raw.subtotal_cents)! } : {}),
    ...(intCents(raw.tax_cents) !== undefined ? { taxCents: intCents(raw.tax_cents)! } : {}),
    ...(intCents(raw.freight_cents) !== undefined ? { freightCents: intCents(raw.freight_cents)! } : {}),
    totalCents: total,
    ...(s(raw.job_number, 120) ? { jobNumber: s(raw.job_number, 120)! } : {}),
    lineItems,
    confidence: confidence(raw.confidence),
    ...(s(raw.extraction_notes, 2_000)
      ? { extractionNotes: s(raw.extraction_notes, 2_000)! }
      : {}),
    promptVersion: PROMPT_VERSION,
    modelUsed: DEFAULT_MODEL,
  };
}

/** Extract invoice fields from PDF bytes. Returns null if extraction
 *  fails for any reason (no API key, Anthropic call errors, model
 *  declined to call the tool, malformed JSON). The caller falls back
 *  to a minimal draft. */
export async function extractInvoiceFromPdf(
  pdfBytes: Buffer,
): Promise<ExtractedInvoice | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const base64 = pdfBytes.toString('base64');
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2_000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract the invoice. Return integer cents and yyyy-mm-dd dates.',
            },
          ],
        },
      ],
    });

    // Find the tool_use block — the prompt forces tool use, but defend.
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === TOOL.name) {
        return shape(block.input as RawExtraction);
      }
    }
    return null;
  } catch {
    return null;
  }
}
