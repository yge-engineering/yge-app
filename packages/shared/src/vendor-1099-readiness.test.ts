import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendor1099Readiness } from './vendor-1099-readiness';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Trucking LLC',
    kind: 'TRUCKING',
    w9OnFile: true,
    w9CollectedOn: '2025-06-01',
    is1099Reportable: true,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    taxId: '12-3456789',
    addressLine: '123 Main St',
    city: 'Cottonwood',
    state: 'CA',
    zip: '96022',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    vendorName: 'Acme Trucking LLC',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 700_00,
    paidCents: 700_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildVendor1099Readiness', () => {
  it('marks fully-set vendor over threshold as READY', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.ready).toBe(true);
    expect(r.rows[0]?.gaps).toHaveLength(0);
  });

  it('skips vendors not 1099-reportable', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({ is1099Reportable: false })],
      apInvoices: [ap({})],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips vendors below threshold', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [ap({ paidCents: 100_00 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('flags NO_W9', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({ w9OnFile: false })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gaps).toContain('NO_W9');
  });

  it('flags STALE_W9 when on file but old', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({ w9CollectedOn: '2022-01-01' })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gaps).toContain('STALE_W9');
  });

  it('flags NO_TAX_ID', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [vendor({ taxId: '' })],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gaps).toContain('NO_TAX_ID');
  });

  it('flags missing address fields individually', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [
        vendor({
          addressLine: undefined,
          city: undefined,
          state: undefined,
          zip: undefined,
        }),
      ],
      apInvoices: [ap({})],
    });
    expect(r.rows[0]?.gaps).toContain('NO_ADDRESS_LINE');
    expect(r.rows[0]?.gaps).toContain('NO_CITY');
    expect(r.rows[0]?.gaps).toContain('NO_STATE');
    expect(r.rows[0]?.gaps).toContain('NO_ZIP');
  });

  it('only counts paid in target year', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'ap-old', invoiceDate: '2025-12-15', paidCents: 99_999_00 }),
        ap({ id: 'ap-in', invoiceDate: '2026-04-01', paidCents: 700_00 }),
      ],
    });
    expect(r.rows[0]?.ytdPaidCents).toBe(700_00);
  });

  it('rolls up unsupported $ across NOT-ready rows', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-bad', legalName: 'Bad', taxId: '' }),
        vendor({ id: 'v-good', legalName: 'Good' }),
      ],
      apInvoices: [
        ap({ id: 'a-bad', vendorName: 'Bad', paidCents: 5_000_00 }),
        ap({ id: 'a-good', vendorName: 'Good', paidCents: 10_000_00 }),
      ],
    });
    expect(r.rollup.unsupportedCents).toBe(5_000_00);
    expect(r.rollup.readyCount).toBe(1);
    expect(r.rollup.notReadyCount).toBe(1);
  });

  it('sorts NOT-ready first (sorted by YTD desc), then READY', () => {
    const r = buildVendor1099Readiness({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-ok', legalName: 'OK' }),
        vendor({ id: 'v-bad-big', legalName: 'BadBig', taxId: '' }),
        vendor({ id: 'v-bad-sm', legalName: 'BadSmall', w9OnFile: false }),
      ],
      apInvoices: [
        ap({ id: 'a-ok', vendorName: 'OK', paidCents: 100_000_00 }),
        ap({ id: 'a-bb', vendorName: 'BadBig', paidCents: 50_000_00 }),
        ap({ id: 'a-bs', vendorName: 'BadSmall', paidCents: 1_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('v-bad-big');
    expect(r.rows[1]?.vendorId).toBe('v-bad-sm');
    expect(r.rows[2]?.vendorId).toBe('v-ok');
  });
});
