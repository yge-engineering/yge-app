import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildPortfolioCashNetSnapshot } from './portfolio-cash-net-snapshot';

function ar(over: Partial<ArPayment>): ArPayment {
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
    ...over,
  } as ArPayment;
}

function ap(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'apinv-1',
    vendorName: 'Acme',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: true,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioCashNetSnapshot', () => {
  it('sums AR minus AP', () => {
    const r = buildPortfolioCashNetSnapshot({
      asOf: '2026-04-30',
      arPayments: [ar({ amountCents: 100_000_00 })],
      apPayments: [ap({ amountCents: 30_000_00 })],
    });
    expect(r.totalReceiptsCents).toBe(100_000_00);
    expect(r.totalDisbursementsCents).toBe(30_000_00);
    expect(r.netCents).toBe(70_000_00);
  });

  it('separates ytd vs cumulative', () => {
    const r = buildPortfolioCashNetSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      arPayments: [
        ar({ id: 'a', receivedOn: '2025-04-15', amountCents: 50_000_00 }),
        ar({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [
        ap({ id: 'a', paidOn: '2025-04-15', amountCents: 20_000_00 }),
        ap({ id: 'b', paidOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
    });
    expect(r.totalReceiptsCents).toBe(150_000_00);
    expect(r.totalDisbursementsCents).toBe(50_000_00);
    expect(r.ytdReceiptsCents).toBe(100_000_00);
    expect(r.ytdDisbursementsCents).toBe(30_000_00);
    expect(r.ytdNetCents).toBe(70_000_00);
  });

  it('excludes voided AP from disbursements', () => {
    const r = buildPortfolioCashNetSnapshot({
      asOf: '2026-04-30',
      arPayments: [],
      apPayments: [
        ap({ amountCents: 20_000_00, voided: false }),
        ap({ amountCents: 99_000_00, voided: true }),
      ],
    });
    expect(r.totalDisbursementsCents).toBe(20_000_00);
  });

  it('ignores payments after asOf', () => {
    const r = buildPortfolioCashNetSnapshot({
      asOf: '2026-04-30',
      arPayments: [ar({ receivedOn: '2026-05-15', amountCents: 100_000_00 })],
      apPayments: [ap({ paidOn: '2026-05-15', amountCents: 30_000_00 })],
    });
    expect(r.netCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCashNetSnapshot({ arPayments: [], apPayments: [] });
    expect(r.netCents).toBe(0);
  });
});
