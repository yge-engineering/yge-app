import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildVendorPaymentSnapshot } from './vendor-payment-snapshot';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'apinv-1',
    vendorName: 'Granite Construction Co.',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorPaymentSnapshot', () => {
  it('matches canonical vendor names', () => {
    const r = buildVendorPaymentSnapshot({
      vendorName: 'Granite Construction',
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite Construction Co.', amountCents: 50_000_00 }),
        pay({ id: 'b', vendorName: 'GRANITE CONSTRUCTION INC', amountCents: 25_000_00 }),
        pay({ id: 'c', vendorName: 'Olson Iron LLC', amountCents: 99_000_00 }),
      ],
    });
    expect(r.totalPayments).toBe(2);
    expect(r.totalCents).toBe(75_000_00);
  });

  it('counts ytd', () => {
    const r = buildVendorPaymentSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      logYear: 2026,
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite', paidOn: '2025-04-15', amountCents: 100_000_00 }),
        pay({ id: 'b', vendorName: 'Granite', paidOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.ytdPayments).toBe(1);
    expect(r.ytdCents).toBe(50_000_00);
  });

  it('separates cleared vs scheduled', () => {
    const r = buildVendorPaymentSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite', amountCents: 30_000_00, cleared: true }),
        pay({ id: 'b', vendorName: 'Granite', amountCents: 20_000_00, cleared: false }),
      ],
    });
    expect(r.clearedCents).toBe(30_000_00);
    expect(r.scheduledCents).toBe(20_000_00);
  });

  it('counts voided + tracks last paid date', () => {
    const r = buildVendorPaymentSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', vendorName: 'Granite', paidOn: '2026-04-08' }),
        pay({ id: 'b', vendorName: 'Granite', paidOn: '2026-04-22' }),
        pay({ id: 'c', vendorName: 'Granite', paidOn: '2026-04-15', voided: true }),
      ],
    });
    expect(r.voidedCount).toBe(1);
    expect(r.lastPaidDate).toBe('2026-04-22');
  });

  it('handles unknown vendor', () => {
    const r = buildVendorPaymentSnapshot({ vendorName: 'X', apPayments: [] });
    expect(r.totalPayments).toBe(0);
    expect(r.lastPaidDate).toBeNull();
  });
});
