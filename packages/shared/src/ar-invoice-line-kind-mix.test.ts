import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildArInvoiceLineKindMix } from './ar-invoice-line-kind-mix';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 0,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildArInvoiceLineKindMix', () => {
  it('groups line items by kind', () => {
    const r = buildArInvoiceLineKindMix({
      arInvoices: [ar({
        lineItems: [
          { kind: 'LABOR', description: 'l', quantity: 1, unitPriceCents: 0, lineTotalCents: 30_000_00 },
          { kind: 'LABOR', description: 'l2', quantity: 1, unitPriceCents: 0, lineTotalCents: 20_000_00 },
          { kind: 'EQUIPMENT', description: 'e', quantity: 1, unitPriceCents: 0, lineTotalCents: 25_000_00 },
        ],
      })],
    });
    const labor = r.rows.find((x) => x.kind === 'LABOR');
    expect(labor?.lineCount).toBe(2);
    expect(labor?.totalCents).toBe(50_000_00);
  });

  it('counts distinct invoices and jobs per kind', () => {
    const r = buildArInvoiceLineKindMix({
      arInvoices: [
        ar({ id: 'i1', jobId: 'j1', lineItems: [{ kind: 'LABOR', description: 'a', quantity: 1, unitPriceCents: 0, lineTotalCents: 10_000_00 }] }),
        ar({ id: 'i2', jobId: 'j2', lineItems: [{ kind: 'LABOR', description: 'b', quantity: 1, unitPriceCents: 0, lineTotalCents: 10_000_00 }] }),
      ],
    });
    expect(r.rows[0]?.distinctInvoices).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('computes share', () => {
    const r = buildArInvoiceLineKindMix({
      arInvoices: [ar({
        lineItems: [
          { kind: 'LABOR', description: 'l', quantity: 1, unitPriceCents: 0, lineTotalCents: 80_000_00 },
          { kind: 'EQUIPMENT', description: 'e', quantity: 1, unitPriceCents: 0, lineTotalCents: 20_000_00 },
        ],
      })],
    });
    const labor = r.rows.find((x) => x.kind === 'LABOR');
    expect(labor?.share).toBeCloseTo(0.8, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildArInvoiceLineKindMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15', lineItems: [{ kind: 'LABOR', description: 'a', quantity: 1, unitPriceCents: 0, lineTotalCents: 100_00 }] }),
        ar({ id: 'in', invoiceDate: '2026-04-15', lineItems: [{ kind: 'LABOR', description: 'b', quantity: 1, unitPriceCents: 0, lineTotalCents: 100_00 }] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildArInvoiceLineKindMix({
      arInvoices: [ar({
        lineItems: [
          { kind: 'OTHER', description: 'o', quantity: 1, unitPriceCents: 0, lineTotalCents: 1_000_00 },
          { kind: 'LABOR', description: 'l', quantity: 1, unitPriceCents: 0, lineTotalCents: 50_000_00 },
        ],
      })],
    });
    expect(r.rows[0]?.kind).toBe('LABOR');
  });

  it('handles empty input', () => {
    const r = buildArInvoiceLineKindMix({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
