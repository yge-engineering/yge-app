import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildPortfolioCustomerPaymentSnapshot } from './portfolio-customer-payment-snapshot';

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'inv-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'Caltrans',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioCustomerPaymentSnapshot', () => {
  it('counts payments + ytd cents', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      arPayments: [
        pay({ id: 'a', receivedOn: '2025-04-15', amountCents: 200_000_00 }),
        pay({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
    });
    expect(r.totalPayments).toBe(2);
    expect(r.totalCents).toBe(300_000_00);
    expect(r.ytdPayments).toBe(1);
    expect(r.ytdCents).toBe(100_000_00);
  });

  it('breaks down by kind + method', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({
      asOf: '2026-04-30',
      arPayments: [
        pay({ id: 'a', kind: 'PROGRESS', method: 'CHECK' }),
        pay({ id: 'b', kind: 'RETENTION_RELEASE', method: 'ACH' }),
        pay({ id: 'c', kind: 'FINAL', method: 'WIRE' }),
      ],
    });
    expect(r.byKind.PROGRESS).toBe(1);
    expect(r.byKind.RETENTION_RELEASE).toBe(1);
    expect(r.byMethod.CHECK).toBe(1);
    expect(r.byMethod.ACH).toBe(1);
  });

  it('canonicalizes payers and counts distinct', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({
      asOf: '2026-04-30',
      arPayments: [
        pay({ id: 'a', payerName: 'Caltrans' }),
        pay({ id: 'b', payerName: 'CALTRANS' }),
        pay({ id: 'c', payerName: 'Acme Builders LLC' }),
        pay({ id: 'd', payerName: 'Acme Builders, Inc.' }),
      ],
    });
    // canonical form strips LLC/Inc and lowercases — Caltrans = 1, Acme = 1
    expect(r.distinctPayers).toBe(2);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({
      asOf: '2026-04-30',
      arPayments: [
        pay({ id: 'a', jobId: 'j1' }),
        pay({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores payments after asOf', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({
      asOf: '2026-04-30',
      arPayments: [pay({ id: 'late', receivedOn: '2026-05-15' })],
    });
    expect(r.totalPayments).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerPaymentSnapshot({ arPayments: [] });
    expect(r.totalPayments).toBe(0);
  });
});
