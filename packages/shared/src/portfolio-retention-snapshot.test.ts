import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioRetentionSnapshot } from './portfolio-retention-snapshot';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'X',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    retentionCents: 5_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'RETENTION_RELEASE',
    method: 'CHECK',
    receivedOn: '2026-04-25',
    amountCents: 3_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioRetentionSnapshot', () => {
  it('sums held + released + net', () => {
    const r = buildPortfolioRetentionSnapshot({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', retentionCents: 5_000_00 }),
        ar({ id: 'b', retentionCents: 2_000_00 }),
      ],
      arPayments: [arp({ kind: 'RETENTION_RELEASE', amountCents: 3_000_00 })],
    });
    expect(r.heldCents).toBe(7_000_00);
    expect(r.releasedCents).toBe(3_000_00);
    expect(r.netHeldCents).toBe(4_000_00);
  });

  it('ignores non-RETENTION_RELEASE payments + post-asOf', () => {
    const r = buildPortfolioRetentionSnapshot({
      asOf: '2026-04-30',
      arInvoices: [ar({ id: 'a' })],
      arPayments: [
        arp({ id: 'wrong-kind', kind: 'PROGRESS' }),
        arp({ id: 'late', receivedOn: '2026-05-15' }),
      ],
    });
    expect(r.releasedCents).toBe(0);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioRetentionSnapshot({
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', jobId: 'j1' }),
        ar({ id: 'b', jobId: 'j2' }),
      ],
      arPayments: [],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioRetentionSnapshot({
      asOf: '2026-04-30',
      arInvoices: [],
      arPayments: [],
    });
    expect(r.heldCents).toBe(0);
  });
});
