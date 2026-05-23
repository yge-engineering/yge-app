import { describe, it, expect } from 'vitest';
import {
  PurchaseOrderSchema,
  computeTotals,
  renderPurchaseOrder,
  type PurchaseOrder,
} from './purchase-order';

function po(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return PurchaseOrderSchema.parse({
    id: 'po-1',
    poNumber: 'YGE-SS2026-014',
    vendorName: 'Hat Creek Construction Materials',
    vendorAddress: '12345 Hat Creek Rd, Hat Creek CA 96040',
    vendorContactName: 'Sam Smith',
    shipTo: 'Sulphur Springs Job Site, Soquol Rd',
    jobId: 'job-1',
    jobName: 'Sulphur Springs Soquol Rd',
    costCode: '02-AGG',
    orderDate: '2026-05-22',
    requiredByDate: '2026-05-28',
    lines: [
      { description: '3/4" drain rock', quantity: 100, unit: 'TON', unitPriceCents: 25_00 },
      { description: 'Sand fill', quantity: 50, unit: 'TON', unitPriceCents: 18_00 },
    ],
    terms: 'NET_30',
    notes: 'Deliver to north stockpile.',
    signedByName: 'Ryan Young',
    signedByTitle: 'VP',
    ...over,
  });
}

describe('computeTotals', () => {
  it('sums quantity × unit price across lines', () => {
    const t = computeTotals(po());
    expect(t.lineCount).toBe(2);
    expect(t.subtotalCents).toBe(100 * 25_00 + 50 * 18_00);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(t.subtotalCents);
  });

  it('adds optional tax cents', () => {
    const t = computeTotals(po(), 2_500);
    expect(t.taxCents).toBe(2_500);
    expect(t.totalCents).toBe(t.subtotalCents + 2_500);
  });
});

describe('renderPurchaseOrder', () => {
  it('renders header with PO number', () => {
    const body = renderPurchaseOrder(po());
    expect(body).toContain('PURCHASE ORDER YGE-SS2026-014');
  });

  it('includes vendor + ship-to + job + cost code', () => {
    const body = renderPurchaseOrder(po());
    expect(body).toContain('Hat Creek Construction Materials');
    expect(body).toContain('Sulphur Springs Job Site, Soquol Rd');
    expect(body).toContain('Sulphur Springs Soquol Rd');
    expect(body).toContain('02-AGG');
  });

  it('renders each line with quantity + unit + price', () => {
    const body = renderPurchaseOrder(po());
    expect(body).toContain('3/4" drain rock');
    expect(body).toContain('100');
    expect(body).toContain('$25.00');
  });

  it('rolls up subtotal + total', () => {
    const body = renderPurchaseOrder(po(), 250_00);
    expect(body).toContain('Subtotal:');
    expect(body).toContain('Tax:');
    expect(body).toContain('Total:');
  });

  it('signature block ends with YGE', () => {
    const body = renderPurchaseOrder(po());
    expect(body).toContain('Ryan Young');
    expect(body).toContain('VP, Young General Engineering, Inc.');
  });

  it('omits tax line when zero', () => {
    const body = renderPurchaseOrder(po());
    expect(body).not.toContain('Tax:');
  });

  it('terms label is human-friendly', () => {
    expect(renderPurchaseOrder(po({ terms: 'NET_30' }))).toContain('Net 30');
    expect(renderPurchaseOrder(po({ terms: 'DUE_ON_DELIVERY' }))).toContain('Due on delivery');
  });
});
