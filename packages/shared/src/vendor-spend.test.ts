import { describe, expect, it } from 'vitest';
import { buildVendorSpendReport } from './vendor-spend';
import type { ApInvoice } from './ap-invoice';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Acme',
    invoiceDate: '2026-04-01',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

describe('buildVendorSpendReport', () => {
  it('rolls up spend per vendor + sorts highest first', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'Granite', totalCents: 10_000_00 }),
        ap({ id: '2', vendorName: 'Granite', totalCents: 5_000_00 }),
        ap({ id: '3', vendorName: 'Acme', totalCents: 1_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Granite');
    expect(r.rows[0]?.totalSpendCents).toBe(15_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('skips DRAFT + REJECTED', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', status: 'DRAFT', totalCents: 99_999_00 }),
        ap({ id: '2', status: 'REJECTED', totalCents: 99_999_00 }),
        ap({ id: '3', status: 'APPROVED', totalCents: 100_00 }),
        ap({ id: '4', status: 'PENDING', totalCents: 200_00 }),
        ap({ id: '5', status: 'PAID', totalCents: 300_00 }),
      ],
    });
    expect(r.totalSpendCents).toBe(600_00);
  });

  it('filters by date range', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', invoiceDate: '2026-03-31', totalCents: 99_999_00 }),
        ap({ id: '2', invoiceDate: '2026-04-15', totalCents: 100_00 }),
        ap({ id: '3', invoiceDate: '2026-05-01', totalCents: 99_999_00 }),
      ],
    });
    expect(r.totalSpendCents).toBe(100_00);
  });

  it('normalizes vendor names: "Acme Co." merges with "Acme Company LLC"', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'Acme Co.', totalCents: 100_00 }),
        ap({ id: '2', vendorName: 'Acme Company LLC', totalCents: 200_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalSpendCents).toBe(300_00);
  });

  it('keeps variants distinct when normalizeVendorNames=false', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'Acme Co.', totalCents: 100_00 }),
        ap({ id: '2', vendorName: 'Acme Company LLC', totalCents: 200_00 }),
      ],
      normalizeVendorNames: false,
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes outstanding = spend - paid', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'X', totalCents: 1_000_00, paidCents: 600_00 }),
        ap({ id: '2', vendorName: 'X', totalCents: 500_00, paidCents: 0 }),
      ],
    });
    expect(r.rows[0]?.totalPaidCents).toBe(600_00);
    expect(r.rows[0]?.outstandingCents).toBe(900_00);
  });

  it('shareOfPeriod sums to 1 across rows', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'A', totalCents: 600_00 }),
        ap({ id: '2', vendorName: 'B', totalCents: 400_00 }),
      ],
    });
    expect(r.rows[0]?.shareOfPeriod).toBeCloseTo(0.6, 4);
    expect(r.rows[1]?.shareOfPeriod).toBeCloseTo(0.4, 4);
  });

  it('top5SharePct = sum of top 5 / total', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'A', totalCents: 500_00 }),
        ap({ id: '2', vendorName: 'B', totalCents: 300_00 }),
        ap({ id: '3', vendorName: 'C', totalCents: 100_00 }),
        ap({ id: '4', vendorName: 'D', totalCents: 50_00 }),
        ap({ id: '5', vendorName: 'E', totalCents: 30_00 }),
        ap({ id: '6', vendorName: 'F', totalCents: 20_00 }), // sixth gets excluded from top5
      ],
    });
    // top 5 = 500+300+100+50+30 = 980 of 1000 = 0.98
    expect(r.top5SharePct).toBeCloseTo(0.98, 4);
  });

  it('tracks first + last invoice dates per vendor', () => {
    const r = buildVendorSpendReport({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: '1', vendorName: 'X', invoiceDate: '2026-04-15' }),
        ap({ id: '2', vendorName: 'X', invoiceDate: '2026-04-05' }),
        ap({ id: '3', vendorName: 'X', invoiceDate: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceOn).toBe('2026-04-05');
    expect(r.rows[0]?.lastInvoiceOn).toBe('2026-04-25');
  });
});
