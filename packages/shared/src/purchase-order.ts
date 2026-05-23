// Purchase order draft.
//
// Heavy-civil PO is short + standard: vendor + ship-to + cost code
// + line items + terms + signed-by. This module is the data shape +
// a totals helper. No PDF yet — caller renders.
//
// Pure: no DB.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PurchaseOrderTermsSchema = z.enum([
  'NET_30',
  'NET_15',
  'NET_10',
  'DUE_ON_DELIVERY',
  'PRE_PAID',
  'OTHER',
]);
export type PurchaseOrderTerms = z.infer<typeof PurchaseOrderTermsSchema>;

export const PurchaseOrderLineSchema = z.object({
  description: z.string().min(1).max(400),
  quantity: z.number().nonnegative(),
  unit: z.string().max(40).optional(),
  unitPriceCents: z.number().int().nonnegative(),
});
export type PurchaseOrderLine = z.infer<typeof PurchaseOrderLineSchema>;

export const PurchaseOrderSchema = z.object({
  /** Stable PO number — typically YGE-<job-slug>-NNN. */
  id: z.string().min(1).max(80),
  poNumber: z.string().min(1).max(80),
  vendorName: z.string().min(1).max(200),
  vendorAddress: z.string().min(1).max(400),
  vendorContactName: z.string().max(120).optional(),
  /** YGE ship-to (yard or job-site). */
  shipTo: z.string().min(1).max(400),
  jobId: z.string().min(1).max(120).optional(),
  jobName: z.string().max(200).optional(),
  costCode: z.string().max(60).optional(),
  orderDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  requiredByDate: z.string().regex(ISO_DATE).optional(),
  lines: z.array(PurchaseOrderLineSchema).min(1),
  terms: PurchaseOrderTermsSchema.default('NET_30'),
  /** Free-form notes the vendor sees on the PO. */
  notes: z.string().max(2000).optional(),
  signedByName: z.string().min(1).max(120),
  signedByTitle: z.string().min(1).max(120),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export interface PurchaseOrderTotals {
  lineCount: number;
  subtotalCents: number;
  /** Optional tax cents — caller passes when applicable. */
  taxCents: number;
  totalCents: number;
}

export function computeTotals(po: PurchaseOrder, taxCents = 0): PurchaseOrderTotals {
  let subtotal = 0;
  for (const l of po.lines) {
    subtotal += Math.round(l.quantity * l.unitPriceCents);
  }
  return {
    lineCount: po.lines.length,
    subtotalCents: subtotal,
    taxCents,
    totalCents: subtotal + taxCents,
  };
}

/** Render a plain-text PO body suitable for email / PDF. */
export function renderPurchaseOrder(po: PurchaseOrder, taxCents = 0): string {
  const totals = computeTotals(po, taxCents);
  const fmt$ = (cents: number) =>
    `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const lines = po.lines
    .map(
      (l, i) =>
        `${String(i + 1).padStart(2, '0')}. ${l.description.padEnd(40, ' ')} ${
          l.quantity
        } ${l.unit ?? ''} @ ${fmt$(l.unitPriceCents)} = ${fmt$(
          Math.round(l.quantity * l.unitPriceCents),
        )}`,
    )
    .join('\n');

  const body = [
    `PURCHASE ORDER ${po.poNumber}`,
    '',
    `Vendor:   ${po.vendorName}`,
    `          ${po.vendorAddress}`,
    po.vendorContactName ? `Attn:     ${po.vendorContactName}` : '',
    '',
    `Ship to:  ${po.shipTo}`,
    po.jobName ? `Job:      ${po.jobName}${po.jobId ? ` (${po.jobId})` : ''}` : '',
    po.costCode ? `Cost code: ${po.costCode}` : '',
    '',
    `Order date:    ${po.orderDate}`,
    po.requiredByDate ? `Required by:   ${po.requiredByDate}` : '',
    `Terms:         ${termsLabel(po.terms)}`,
    '',
    'Lines:',
    lines,
    '',
    `Subtotal:   ${fmt$(totals.subtotalCents)}`,
    taxCents > 0 ? `Tax:        ${fmt$(totals.taxCents)}` : '',
    `Total:      ${fmt$(totals.totalCents)}`,
    '',
    po.notes ? `Notes: ${po.notes}` : '',
    '',
    'Authorized by:',
    `${po.signedByName}`,
    `${po.signedByTitle}, Young General Engineering, Inc.`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return body;
}

function termsLabel(t: PurchaseOrderTerms): string {
  switch (t) {
    case 'NET_30':
      return 'Net 30';
    case 'NET_15':
      return 'Net 15';
    case 'NET_10':
      return 'Net 10';
    case 'DUE_ON_DELIVERY':
      return 'Due on delivery';
    case 'PRE_PAID':
      return 'Pre-paid';
    case 'OTHER':
      return 'See notes';
  }
}
