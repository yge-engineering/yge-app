import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { Vendor } from './vendor';

import { buildVendor1099Threshold } from './vendor-1099-ytd-threshold';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Acme',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 100_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

function vend(over: Partial<Vendor> & Pick<Vendor, 'legalName' | 'kind'>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    is1099Reportable: false,
    ...over,
  } as Vendor;
}

describe('buildVendor1099Threshold', () => {
  it('flags OVER when YTD >= threshold', () => {
    const r = buildVendor1099Threshold({
      vendors: [vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR', is1099Reportable: true, taxId: '12-3456789' })],
      apPayments: [
        pay({ id: 'a', vendorName: 'Acme', amountCents: 30_000_00 }),
        pay({ id: 'b', vendorName: 'Acme', amountCents: 35_000_00 }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('OVER');
    expect(r.rows[0]?.needsW9Chase).toBe(false);
  });

  it('flags APPROACHING in 80-100% band', () => {
    const r = buildVendor1099Threshold({
      vendors: [vend({ legalName: 'Acme', kind: 'SUPPLIER' })],
      apPayments: [pay({ vendorName: 'Acme', amountCents: 500_00 })], // $500 = 83% of $600
    });
    expect(r.rows[0]?.flag).toBe('APPROACHING');
  });

  it('flags BELOW under 80%', () => {
    const r = buildVendor1099Threshold({
      vendors: [vend({ legalName: 'Acme', kind: 'SUPPLIER' })],
      apPayments: [pay({ vendorName: 'Acme', amountCents: 100_00 })],
    });
    expect(r.rows[0]?.flag).toBe('BELOW');
  });

  it('flags needsW9Chase when OVER + missing taxId', () => {
    const r = buildVendor1099Threshold({
      vendors: [
        vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR', is1099Reportable: true, taxId: undefined }),
      ],
      apPayments: [pay({ vendorName: 'Acme', amountCents: 80_000_00 })],
    });
    expect(r.rows[0]?.needsW9Chase).toBe(true);
  });

  it('flags needsW9Chase when OVER + not 1099-reportable', () => {
    const r = buildVendor1099Threshold({
      vendors: [
        vend({
          legalName: 'Acme',
          kind: 'SUBCONTRACTOR',
          is1099Reportable: false,
          taxId: '12-3456789',
        }),
      ],
      apPayments: [pay({ vendorName: 'Acme', amountCents: 80_000_00 })],
    });
    expect(r.rows[0]?.needsW9Chase).toBe(true);
  });

  it('matches vendor by canonical name including dba', () => {
    const r = buildVendor1099Threshold({
      vendors: [
        vend({
          legalName: 'Acme Holdings',
          dbaName: 'Acme Trenching',
          kind: 'SUBCONTRACTOR',
          is1099Reportable: true,
          taxId: '12-3456789',
        }),
      ],
      apPayments: [pay({ vendorName: 'Acme Trenching, LLC', amountCents: 80_000_00 })],
    });
    expect(r.rows[0]?.vendorId).toBe('v-1');
  });

  it('skips voided payments', () => {
    const r = buildVendor1099Threshold({
      vendors: [vend({ legalName: 'Acme', kind: 'SUPPLIER' })],
      apPayments: [
        pay({ id: 'v', vendorName: 'Acme', voided: true, amountCents: 80_000_00 }),
        pay({ id: 'g', vendorName: 'Acme', amountCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.paidYtdCents).toBe(100_00);
  });

  it('respects custom threshold', () => {
    const r = buildVendor1099Threshold({
      thresholdCents: 100_00,
      vendors: [vend({ legalName: 'Acme', kind: 'SUPPLIER' })],
      apPayments: [pay({ vendorName: 'Acme', amountCents: 150_00 })],
    });
    expect(r.rows[0]?.flag).toBe('OVER');
  });

  it('respects window bounds', () => {
    const r = buildVendor1099Threshold({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      vendors: [vend({ legalName: 'Acme', kind: 'SUPPLIER' })],
      apPayments: [
        pay({ id: 'old', vendorName: 'Acme', paidOn: '2026-03-15', amountCents: 70_000_00 }),
        pay({ id: 'in', vendorName: 'Acme', paidOn: '2026-04-15', amountCents: 50_00 }),
      ],
    });
    expect(r.rows[0]?.paidYtdCents).toBe(50_00);
  });

  it('sorts needsW9Chase first', () => {
    const r = buildVendor1099Threshold({
      vendors: [
        vend({ legalName: 'Clean', kind: 'SUBCONTRACTOR', is1099Reportable: true, taxId: '11-1111111' }),
        vend({ legalName: 'Chase', kind: 'SUBCONTRACTOR', is1099Reportable: true, taxId: undefined }),
      ],
      apPayments: [
        pay({ id: 'c', vendorName: 'Clean', amountCents: 80_000_00 }),
        pay({ id: 'h', vendorName: 'Chase', amountCents: 80_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Chase');
  });

  it('rolls up portfolio counts', () => {
    const r = buildVendor1099Threshold({
      vendors: [vend({ legalName: 'A', kind: 'SUPPLIER' })],
      apPayments: [pay({ vendorName: 'A', amountCents: 80_000_00 })],
    });
    expect(r.rollup.overThresholdCount).toBe(1);
    expect(r.rollup.totalPaidCents).toBe(80_000_00);
  });
});
