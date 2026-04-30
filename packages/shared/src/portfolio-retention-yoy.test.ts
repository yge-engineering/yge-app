import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

import { buildPortfolioRetentionYoy } from './portfolio-retention-yoy';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'X',
    invoiceDate: '2026-12-15',
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
    receivedOn: '2026-12-15',
    amountCents: 3_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

describe('buildPortfolioRetentionYoy', () => {
  it('snapshots prior + current held + released', () => {
    const r = buildPortfolioRetentionYoy({
      currentYear: 2026,
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-12-15', retentionCents: 4_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-12-15', retentionCents: 5_000_00 }),
      ],
      arPayments: [arp({ kind: 'RETENTION_RELEASE', receivedOn: '2026-12-20', amountCents: 1_000_00 })],
    });
    expect(r.prior.heldCents).toBe(4_000_00);
    expect(r.current.heldCents).toBe(9_000_00);
    expect(r.current.releasedCents).toBe(1_000_00);
    expect(r.current.netHeldCents).toBe(8_000_00);
  });

  it('ignores non-RETENTION_RELEASE payments', () => {
    const r = buildPortfolioRetentionYoy({
      currentYear: 2026,
      arInvoices: [ar({ id: 'a', retentionCents: 5_000_00 })],
      arPayments: [arp({ kind: 'PROGRESS' })],
    });
    expect(r.current.releasedCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioRetentionYoy({
      currentYear: 2026,
      arInvoices: [],
      arPayments: [],
    });
    expect(r.current.heldCents).toBe(0);
  });
});
