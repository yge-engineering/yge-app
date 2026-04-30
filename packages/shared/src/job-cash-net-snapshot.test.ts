import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildJobCashNetSnapshot } from './job-cash-net-snapshot';

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
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 30_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildJobCashNetSnapshot', () => {
  it('sums AR for the job minus AP for the job (via invoice lookup)', () => {
    const r = buildJobCashNetSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      arPayments: [
        ar({ id: 'a', jobId: 'j1', amountCents: 100_000_00 }),
        ar({ id: 'b', jobId: 'j2', amountCents: 50_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p1', apInvoiceId: 'apinv-j1', amountCents: 30_000_00 }),
        ap({ id: 'p2', apInvoiceId: 'apinv-j2', amountCents: 20_000_00 }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-j1': 'j1', 'apinv-j2': 'j2' },
    });
    expect(r.totalReceiptsCents).toBe(100_000_00);
    expect(r.totalDisbursementsCents).toBe(30_000_00);
    expect(r.netCents).toBe(70_000_00);
    expect(r.receiptCount).toBe(1);
    expect(r.disbursementCount).toBe(1);
  });

  it('excludes voided AP', () => {
    const r = buildJobCashNetSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      arPayments: [],
      apPayments: [
        ap({ id: 'p1', apInvoiceId: 'apinv-1', amountCents: 30_000_00, voided: false }),
        ap({ id: 'p2', apInvoiceId: 'apinv-1', amountCents: 99_000_00, voided: true }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1' },
    });
    expect(r.totalDisbursementsCents).toBe(30_000_00);
  });

  it('ignores payments after asOf', () => {
    const r = buildJobCashNetSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      arPayments: [ar({ receivedOn: '2026-05-15' })],
      apPayments: [ap({ paidOn: '2026-05-15' })],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1' },
    });
    expect(r.netCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildJobCashNetSnapshot({ jobId: 'j1', arPayments: [], apPayments: [] });
    expect(r.netCents).toBe(0);
  });
});
