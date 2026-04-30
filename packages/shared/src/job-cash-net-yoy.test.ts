import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

import { buildJobCashNetYoy } from './job-cash-net-yoy';

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
    amountCents: 50_000_00,
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

describe('buildJobCashNetYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobCashNetYoy({
      jobId: 'j1',
      currentYear: 2026,
      arPayments: [
        ar({ id: 'a', receivedOn: '2025-04-15', amountCents: 50_000_00 }),
        ar({ id: 'b', receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [
        ap({ id: 'p1', paidOn: '2025-04-15', amountCents: 20_000_00 }),
        ap({ id: 'p2', paidOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
      apInvoiceJobByInvoiceId: { 'apinv-1': 'j1' },
    });
    expect(r.priorReceiptsCents).toBe(50_000_00);
    expect(r.priorDisbursementsCents).toBe(20_000_00);
    expect(r.priorNetCents).toBe(30_000_00);
    expect(r.currentNetCents).toBe(70_000_00);
    expect(r.netDelta).toBe(40_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobCashNetYoy({
      jobId: 'X',
      currentYear: 2026,
      arPayments: [],
      apPayments: [],
    });
    expect(r.priorNetCents).toBe(0);
  });
});
