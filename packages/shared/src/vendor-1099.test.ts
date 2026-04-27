import { describe, expect, it } from 'vitest';
import { buildVendor1099Report } from './vendor-1099';
import type { ApPayment } from './ap-payment';
import type { Vendor } from './vendor';

const NOW = new Date('2026-12-15T00:00:00Z');

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-aaaaaaaa',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    legalName: 'Acme Concrete LLC',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2025-01-15',
    coiOnFile: true,
    coiExpiresOn: '2026-12-31',
    paymentTerms: 'NET_30',
    onHold: false,
    taxId: '12-3456789',
    ...over,
  } as Vendor;
}

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    apInvoiceId: 'api-aaaaaaaa',
    vendorName: 'Acme Concrete LLC',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 200_00,
    cleared: true,
    voided: false,
    ...over,
  };
}

describe('buildVendor1099Report', () => {
  it('aggregates payments across the year, ignoring voided', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({})],
      payments: [
        pay({ id: 'p1', amountCents: 300_00 }),
        pay({ id: 'p2', amountCents: 400_00 }),
        pay({ id: 'p3', amountCents: 9_999_00, voided: true }),
      ],
      asOf: NOW,
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.paidYtdCents).toBe(700_00);
    expect(r.rows[0]?.paymentCount).toBe(2);
    expect(r.rows[0]?.overThreshold).toBe(true);
  });

  it('flags an over-threshold vendor missing a current W-9', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [
        vendor({
          // W-9 collected 4 years ago — outside the 3-year refresh.
          w9CollectedOn: '2022-01-15',
        }),
      ],
      payments: [pay({ amountCents: 5_000_00 })],
      asOf: NOW,
    });
    const row = r.rows[0]!;
    expect(row.overThreshold).toBe(true);
    expect(row.missingCurrentW9).toBe(true);
    expect(r.missingW9Count).toBe(1);
  });

  it('flags an over-threshold vendor missing a tax ID', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({ taxId: undefined })],
      payments: [pay({ amountCents: 5_000_00 })],
      asOf: NOW,
    });
    expect(r.rows[0]?.missingTaxId).toBe(true);
  });

  it('does not flag W-9 missing for non-1099-reportable vendors', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({ is1099Reportable: false, w9CollectedOn: '2022-01-15' })],
      payments: [pay({ amountCents: 5_000_00 })],
      asOf: NOW,
    });
    expect(r.rows[0]?.missingCurrentW9).toBe(false);
  });

  it('respects threshold — under-threshold vendors are not flagged', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({})],
      payments: [pay({ amountCents: 500_00 })],
      asOf: NOW,
    });
    expect(r.rows[0]?.overThreshold).toBe(false);
    expect(r.reportableCount).toBe(0);
  });

  it('only counts payments inside the requested year', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({})],
      payments: [
        pay({ id: 'p-2025', paidOn: '2025-12-31', amountCents: 99_999_00 }),
        pay({ id: 'p-2026', paidOn: '2026-01-01', amountCents: 700_00 }),
        pay({ id: 'p-2027', paidOn: '2027-01-01', amountCents: 99_999_00 }),
      ],
      asOf: NOW,
    });
    expect(r.rows[0]?.paidYtdCents).toBe(700_00);
  });

  it('matches vendor master across "Acme Concrete LLC" / "Acme Concrete, LLC."', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({ legalName: 'Acme Concrete, LLC.' })],
      payments: [pay({ vendorName: 'Acme Concrete LLC', amountCents: 700_00 })],
      asOf: NOW,
    });
    expect(r.rows[0]?.vendorId).toBe('vnd-aaaaaaaa');
  });

  it('returns vendorId=null when the AP payment name does not match any vendor', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [vendor({ legalName: 'Acme Concrete' })],
      payments: [pay({ vendorName: 'Some Other Vendor', amountCents: 700_00 })],
      asOf: NOW,
    });
    expect(r.rows[0]?.vendorId).toBe(null);
    // No vendor record means we can't say is1099Reportable, so it
    // defaults to false; over-threshold but not file-blocked.
    expect(r.rows[0]?.is1099Reportable).toBe(false);
  });

  it('sorts rows by total paid descending', () => {
    const r = buildVendor1099Report({
      year: 2026,
      vendors: [
        vendor({ id: 'vnd-1', legalName: 'Smaller Vendor' }),
        vendor({ id: 'vnd-2', legalName: 'Bigger Vendor' }),
      ],
      payments: [
        pay({ id: 'p1', vendorName: 'Smaller Vendor', amountCents: 1_000_00 }),
        pay({ id: 'p2', vendorName: 'Bigger Vendor', amountCents: 5_000_00 }),
      ],
      asOf: NOW,
    });
    expect(r.rows[0]?.vendorName).toBe('Bigger Vendor');
    expect(r.rows[1]?.vendorName).toBe('Smaller Vendor');
  });
});
