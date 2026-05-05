// AP-invoice extraction prompt — v1.
//
// Versioning rule (per CLAUDE.md): one file per use-case version. When
// the prompt changes meaningfully, copy this file to v2, bump
// PROMPT_VERSION, and update the service import. Keep old versions
// around for retro testing.

export const PROMPT_VERSION = 'ap-invoice-extract@1.0.0';

export const SYSTEM_PROMPT = [
  'You read a vendor invoice (PDF) addressed to Young General Engineering (YGE),',
  'a California heavy-civil contractor, and extract structured data so the',
  "office doesn't have to retype it.",
  '',
  'Be precise about money. Every dollar amount must be returned as integer cents',
  '(e.g. $1,234.56 → 123456). Do not round.',
  '',
  'Dates are returned as yyyy-mm-dd strings. If the invoice shows a date in any',
  'other format, convert. If a date is genuinely missing, omit the field rather',
  "than guessing — don't invent a date.",
  '',
  'For line items: capture the as-billed line description verbatim, the quantity,',
  "the unit price, and the line total. If quantity or unit price isn't shown",
  'explicitly (e.g. lump-sum or service-only invoices), set quantity=1 and',
  'unit_price_cents=line_total_cents.',
  '',
  'Vendor name comes from the letterhead / "From" / "Remit to" block — not the',
  '"Bill to" block. The "Bill to" is YGE.',
  '',
  'Heavy-civil context: invoices commonly include trucking, aggregate (rock,',
  'sand, AB), asphalt, concrete, equipment rental, fuel, materials testing, and',
  'shop service. Use plain-English line descriptions.',
  '',
  'Return your output by calling the submit_invoice_extraction tool exactly once.',
  'If the document genuinely is not an invoice (statement, receipt, packing slip',
  'with no totals), call the tool with confidence="LOW" and an explanatory',
  'extraction_notes string. Do not refuse to call the tool.',
].join('\n');

export const TOOL = {
  name: 'submit_invoice_extraction',
  description:
    'Submit the extracted invoice data. Use null/omit for fields the document does not provide; do not invent values.',
  input_schema: {
    type: 'object' as const,
    properties: {
      vendor_name: {
        type: 'string',
        description:
          'Company / contractor / supplier on the letterhead or remit-to block.',
      },
      invoice_number: {
        type: 'string',
        description: "Vendor's invoice number / reference (their identifier).",
      },
      invoice_date: {
        type: 'string',
        description: 'Date issued, yyyy-mm-dd.',
      },
      due_date: {
        type: 'string',
        description: 'Due date, yyyy-mm-dd.',
      },
      subtotal_cents: {
        type: 'integer',
        description: 'Pre-tax subtotal in cents.',
      },
      tax_cents: {
        type: 'integer',
        description: 'Tax amount in cents.',
      },
      freight_cents: {
        type: 'integer',
        description: 'Freight / shipping / delivery line in cents.',
      },
      total_cents: {
        type: 'integer',
        description: "Bottom-line total in cents (what we're being asked to pay).",
      },
      job_number: {
        type: 'string',
        description:
          'YGE job number or PO number printed on the invoice, if present.',
      },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            unit: { type: 'string' },
            quantity: { type: 'number' },
            unit_price_cents: { type: 'integer' },
            line_total_cents: { type: 'integer' },
          },
          required: ['description', 'line_total_cents'],
        },
      },
      confidence: {
        type: 'string',
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        description:
          'HIGH = standard well-formatted invoice; MEDIUM = some ambiguity; LOW = scan/handwritten/non-invoice.',
      },
      extraction_notes: {
        type: 'string',
        description:
          'One or two sentences flagging anything the AP clerk should double-check.',
      },
    },
    required: ['vendor_name', 'total_cents', 'confidence'],
  },
};
