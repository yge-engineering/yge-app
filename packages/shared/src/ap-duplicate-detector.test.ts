import { describe, expect, it } from 'vitest';
import { findApDuplicates } from './ap-duplicate-detector';
import type { ApInvoice } from './ap-invoice';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme Materials',
    invoiceDate: '2026-04-01',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

describe('findApDuplicates', () => {
  it('skips DRAFT and REJECTED', () => {
    const r = findApDuplicates([
      ap({ id: 'api-1', status: 'DRAFT', invoiceNumber: 'INV-100' }),
      ap({ id: 'api-2', status: 'REJECTED', invoiceNumber: 'INV-100' }),
      ap({ id: 'api-3', status: 'APPROVED', invoiceNumber: 'INV-100' }),
    ]);
    // Only api-3 makes the pool — no pairs.
    expect(r.scannedCount).toBe(1);
    expect(r.pairs).toHaveLength(0);
  });

  it('flags EXACT when same vendor + invoice number + total', () => {
    const r = findApDuplicates([
      ap({ id: 'api-1', vendorName: 'Acme Inc.', invoiceNumber: 'A-100', totalCents: 500_00 }),
      ap({
        id: 'api-2',
        vendorName: 'Acme Incorporated',
        invoiceDate: '2026-04-05',
        invoiceNumber: 'A-100',
        totalCents: 500_00,
      }),
    ]);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]?.confidence).toBe('EXACT');
    expect(r.exactCount).toBe(1);
  });

  it('normalizes "Acme Co." and "Acme Company LLC" into the same bucket', () => {
    const r = findApDuplicates([
      ap({ id: 'api-1', vendorName: 'Acme Co.', invoiceNumber: 'A-1', totalCents: 100_00 }),
      ap({
        id: 'api-2',
        vendorName: 'Acme Company LLC',
        invoiceDate: '2026-04-02',
        invoiceNumber: 'A-1',
        totalCents: 100_00,
      }),
    ]);
    expect(r.pairs[0]?.confidence).toBe('EXACT');
  });

  it('flags HIGH when same total, no number, within 7 days', () => {
    const r = findApDuplicates([
      ap({
        id: 'api-1',
        vendorName: 'Granite Rock',
        invoiceDate: '2026-04-01',
        invoiceNumber: '',
        totalCents: 5_000_00,
      }),
      ap({
        id: 'api-2',
        vendorName: 'Granite Rock',
        invoiceDate: '2026-04-05', // 4 days later
        invoiceNumber: '',
        totalCents: 5_000_00,
      }),
    ]);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]?.confidence).toBe('HIGH');
    expect(r.pairs[0]?.daysApart).toBe(4);
  });

  it('flags MEDIUM when same total within 30 days but >7', () => {
    const r = findApDuplicates([
      ap({
        id: 'api-1',
        vendorName: 'Granite Rock',
        invoiceDate: '2026-04-01',
        invoiceNumber: '',
        totalCents: 5_000_00,
      }),
      ap({
        id: 'api-2',
        vendorName: 'Granite Rock',
        invoiceDate: '2026-04-20', // 19 days later
        invoiceNumber: '',
        totalCents: 5_000_00,
      }),
    ]);
    expect(r.pairs[0]?.confidence).toBe('MEDIUM');
    expect(r.pairs[0]?.daysApart).toBe(19);
  });

  it('flags MEDIUM when same invoice number but different totals', () => {
    const r = findApDuplicates([
      ap({
        id: 'api-1',
        vendorName: 'Acme',
        invoiceNumber: 'X-99',
        totalCents: 100_00,
      }),
      ap({
        id: 'api-2',
        vendorName: 'Acme',
        invoiceDate: '2026-04-15',
        invoiceNumber: 'X-99',
        totalCents: 150_00,
      }),
    ]);
    expect(r.pairs[0]?.confidence).toBe('MEDIUM');
    expect(r.pairs[0]?.reasons.some((s) => s.includes('Different totals'))).toBe(true);
  });

  it('does NOT flag same total >30 days apart with no invoice number', () => {
    const r = findApDuplicates([
      ap({
        id: 'api-1',
        vendorName: 'Acme',
        invoiceDate: '2026-01-01',
        invoiceNumber: '',
        totalCents: 100_00,
      }),
      ap({
        id: 'api-2',
        vendorName: 'Acme',
        invoiceDate: '2026-03-15',
        invoiceNumber: '',
        totalCents: 100_00,
      }),
    ]);
    expect(r.pairs).toHaveLength(0);
  });

  it('does NOT cross vendors', () => {
    const r = findApDuplicates([
      ap({ id: 'api-1', vendorName: 'Acme', invoiceNumber: 'X-1', totalCents: 100_00 }),
      ap({ id: 'api-2', vendorName: 'Beta', invoiceNumber: 'X-1', totalCents: 100_00 }),
    ]);
    expect(r.pairs).toHaveLength(0);
  });

  it('skips zero-total invoices for the "same total" rule', () => {
    const r = findApDuplicates([
      ap({ id: 'api-1', vendorName: 'Acme', invoiceNumber: '', totalCents: 0 }),
      ap({
        id: 'api-2',
        vendorName: 'Acme',
        invoiceDate: '2026-04-03',
        invoiceNumber: '',
        totalCents: 0,
      }),
    ]);
    expect(r.pairs).toHaveLength(0);
  });

  it('sorts EXACT first, then HIGH, then MEDIUM', () => {
    const r = findApDuplicates([
      // EXACT pair
      ap({ id: 'a1', vendorName: 'A', invoiceNumber: 'X-1', totalCents: 100_00, invoiceDate: '2026-04-01' }),
      ap({ id: 'a2', vendorName: 'A', invoiceNumber: 'X-1', totalCents: 100_00, invoiceDate: '2026-04-02' }),
      // HIGH pair (different vendor)
      ap({ id: 'b1', vendorName: 'B', invoiceNumber: '', totalCents: 200_00, invoiceDate: '2026-04-01' }),
      ap({ id: 'b2', vendorName: 'B', invoiceNumber: '', totalCents: 200_00, invoiceDate: '2026-04-04' }),
      // MEDIUM pair (different vendor)
      ap({ id: 'c1', vendorName: 'C', invoiceNumber: '', totalCents: 300_00, invoiceDate: '2026-04-01' }),
      ap({ id: 'c2', vendorName: 'C', invoiceNumber: '', totalCents: 300_00, invoiceDate: '2026-04-15' }),
    ]);
    expect(r.pairs.map((p) => p.confidence)).toEqual(['EXACT', 'HIGH', 'MEDIUM']);
  });

  it('produces a count summary', () => {
    const r = findApDuplicates([
      ap({ id: 'a1', vendorName: 'A', invoiceNumber: 'X-1', totalCents: 100_00, invoiceDate: '2026-04-01' }),
      ap({ id: 'a2', vendorName: 'A', invoiceNumber: 'X-1', totalCents: 100_00, invoiceDate: '2026-04-02' }),
    ]);
    expect(r.exactCount).toBe(1);
    expect(r.highCount).toBe(0);
    expect(r.mediumCount).toBe(0);
  });
});
