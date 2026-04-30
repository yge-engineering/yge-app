import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildVendorPaymentYoy } from './vendor-payment-yoy';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'apinv-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorPaymentYoy', () => {
  it('compares two years for one vendor', () => {
    const r = buildVendorPaymentYoy({
      vendorName: 'Granite',
      currentYear: 2026,
      apPayments: [
        pay({ id: 'a', paidOn: '2025-04-15', amountCents: 30_000_00 }),
        pay({ id: 'b', paidOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.priorPayments).toBe(1);
    expect(r.currentPayments).toBe(1);
    expect(r.centsDelta).toBe(20_000_00);
  });

  it('counts voided separately', () => {
    const r = buildVendorPaymentYoy({
      vendorName: 'Granite',
      currentYear: 2026,
      apPayments: [
        pay({ id: 'a', paidOn: '2026-04-15' }),
        pay({ id: 'b', paidOn: '2026-04-15', voided: true }),
      ],
    });
    expect(r.currentPayments).toBe(1);
    expect(r.currentVoided).toBe(1);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorPaymentYoy({ vendorName: 'X', currentYear: 2026, apPayments: [] });
    expect(r.priorPayments).toBe(0);
  });
});
