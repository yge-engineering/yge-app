import { describe, expect, it } from 'vitest';
import {
  computeApPaymentRollup,
  sumApPaymentsForInvoice,
  type ApPayment,
} from './ap-payment';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    apInvoiceId: 'api-aaaaaaaa',
    vendorName: 'Acme Concrete',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 1_000_00,
    cleared: true,
    voided: false,
    ...over,
  };
}

describe('sumApPaymentsForInvoice', () => {
  it('sums non-voided payments matching the invoice', () => {
    const total = sumApPaymentsForInvoice('api-aaaaaaaa', [
      pay({ id: 'app-1', amountCents: 5_000_00 }),
      pay({ id: 'app-2', amountCents: 3_000_00 }),
      pay({ id: 'app-3', apInvoiceId: 'api-bbbbbbbb', amountCents: 99_999_00 }),
    ]);
    expect(total).toBe(8_000_00);
  });

  it('excludes voided payments', () => {
    const total = sumApPaymentsForInvoice('api-aaaaaaaa', [
      pay({ id: 'app-1', amountCents: 5_000_00 }),
      pay({ id: 'app-2', amountCents: 3_000_00, voided: true }),
    ]);
    expect(total).toBe(5_000_00);
  });
});

describe('computeApPaymentRollup', () => {
  it('separates uncleared and voided', () => {
    const r = computeApPaymentRollup([
      pay({ id: 'app-1', amountCents: 1_000_00, cleared: true }),
      pay({ id: 'app-2', amountCents: 500_00, cleared: false }),
      pay({ id: 'app-3', amountCents: 250_00, cleared: false }),
      pay({ id: 'app-4', amountCents: 9_999_00, voided: true }),
    ]);
    expect(r.total).toBe(4);
    // Voided is excluded from totalCents.
    expect(r.totalCents).toBe(1_750_00);
    expect(r.uncleared).toBe(2);
    expect(r.unclearedCents).toBe(750_00);
    expect(r.voided).toBe(1);
  });
});
