import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { Vendor } from './vendor';

import { buildVendor1099ByKind } from './vendor-1099-by-kind';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2026-01-01',
    onHold: false,
    ...over,
  } as Vendor;
}

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 5_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendor1099ByKind', () => {
  it('groups by VendorKind', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [
        vend({ id: 'a', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', kind: 'TRUCKING' }),
        vend({ id: 'c', kind: 'SUBCONTRACTOR' }),
      ],
      payments: [],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums YTD reportable cents per kind', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [
        vend({ id: 'a', legalName: 'Granite', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', legalName: 'Bob Trucking', kind: 'TRUCKING' }),
      ],
      payments: [
        pay({ id: '1', vendorName: 'Granite', amountCents: 100_000_00 }),
        pay({ id: '2', vendorName: 'Bob Trucking', amountCents: 50_000_00 }),
      ],
    });
    const sub = r.rows.find((x) => x.kind === 'SUBCONTRACTOR');
    const trk = r.rows.find((x) => x.kind === 'TRUCKING');
    expect(sub?.totalReportableCents).toBe(100_000_00);
    expect(trk?.totalReportableCents).toBe(50_000_00);
  });

  it('flags overThreshold using $600 default', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [
        vend({ id: 'a', legalName: 'Big Sub', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'b', legalName: 'Tiny Sub', kind: 'SUBCONTRACTOR' }),
      ],
      payments: [
        pay({ id: '1', vendorName: 'Big Sub', amountCents: 5_000_00 }),
        pay({ id: '2', vendorName: 'Tiny Sub', amountCents: 5_00 }),
      ],
    });
    expect(r.rows[0]?.overThresholdCount).toBe(1);
  });

  it('flags missingW9 only when over threshold', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      asOf: new Date('2026-06-01T00:00:00Z'),
      vendors: [
        vend({
          id: 'a',
          legalName: 'No W9 Sub',
          kind: 'SUBCONTRACTOR',
          w9OnFile: false,
        }),
        vend({
          id: 'b',
          legalName: 'Tiny No W9',
          kind: 'SUBCONTRACTOR',
          w9OnFile: false,
        }),
      ],
      payments: [
        pay({ id: '1', vendorName: 'No W9 Sub', amountCents: 5_000_00 }),
        pay({ id: '2', vendorName: 'Tiny No W9', amountCents: 5_00 }),
      ],
    });
    expect(r.rows[0]?.missingW9Count).toBe(1);
    expect(r.rows[0]?.overThresholdCount).toBe(1);
  });

  it('skips voided + out-of-year payments', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [vend({ id: 'a', legalName: 'X', kind: 'SUBCONTRACTOR' })],
      payments: [
        pay({ id: '1', vendorName: 'X', amountCents: 5_000_00, voided: true }),
        pay({ id: '2', vendorName: 'X', amountCents: 5_000_00, paidOn: '2025-12-31' }),
        pay({ id: '3', vendorName: 'X', amountCents: 1_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalReportableCents).toBe(1_000_00);
  });

  it('only counts reportable vendors in totals', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [
        vend({ id: 'a', legalName: 'Yes', kind: 'SUBCONTRACTOR', is1099Reportable: true }),
        vend({ id: 'b', legalName: 'Big Inc', kind: 'SUBCONTRACTOR', is1099Reportable: false }),
      ],
      payments: [
        pay({ id: '1', vendorName: 'Yes', amountCents: 1_000_00 }),
        pay({ id: '2', vendorName: 'Big Inc', amountCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.reportableCount).toBe(1);
    expect(r.rows[0]?.totalReportableCents).toBe(1_000_00);
  });

  it('sorts by totalReportableCents desc', () => {
    const r = buildVendor1099ByKind({
      year: 2026,
      vendors: [
        vend({ id: 'a', legalName: 'Small', kind: 'TRUCKING' }),
        vend({ id: 'b', legalName: 'Big', kind: 'SUBCONTRACTOR' }),
      ],
      payments: [
        pay({ id: '1', vendorName: 'Small', amountCents: 5_000_00 }),
        pay({ id: '2', vendorName: 'Big', amountCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('SUBCONTRACTOR');
  });

  it('handles empty input', () => {
    const r = buildVendor1099ByKind({ year: 2026, vendors: [], payments: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalReportableCents).toBe(0);
  });
});
