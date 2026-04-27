import { describe, expect, it } from 'vitest';
import { buildArWriteOffCandidates } from './ar-writeoff-candidates';
import type { ArInvoice } from './ar-invoice';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2024-01-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildArWriteOffCandidates', () => {
  it('only surfaces invoices >180 days old', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'recent', invoiceDate: '2026-04-01' }),
        ar({ id: 'old', invoiceDate: '2025-09-01' }),
      ],
    });
    expect(r.rows.map((x) => x.invoiceId)).toEqual(['old']);
  });

  it('classifies tiers correctly', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '180', invoiceDate: '2025-09-01' }),  // 238 days = STALE_180
        ar({ id: '365', invoiceDate: '2025-04-01' }),  // 391 days = STALE_365
        ar({ id: '730', invoiceDate: '2024-01-01' }),  // 847 days = STALE_730
      ],
    });
    const tiers = new Map(r.rows.map((x) => [x.invoiceId, x.tier]));
    expect(tiers.get('180')).toBe('STALE_180');
    expect(tiers.get('365')).toBe('STALE_365');
    expect(tiers.get('730')).toBe('STALE_730');
  });

  it('skips DRAFT, PAID, WRITTEN_OFF', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'p', status: 'PAID', paidCents: 100_00 }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
        ar({ id: 's', status: 'SENT' }),
      ],
    });
    expect(r.rows.map((x) => x.invoiceId)).toEqual(['s']);
  });

  it('skips zero-balance', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'fully', status: 'PARTIALLY_PAID', totalCents: 100_00, paidCents: 100_00 }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('totals + byTier rollup', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: '1', invoiceDate: '2025-09-01', totalCents: 100_00 }),
        ar({ id: '2', invoiceDate: '2025-04-01', totalCents: 200_00 }),
        ar({ id: '3', invoiceDate: '2024-01-01', totalCents: 500_00 }),
      ],
    });
    expect(r.totalCandidatesCents).toBe(800_00);
    expect(r.byTier.STALE_180).toBe(1);
    expect(r.byTier.STALE_365).toBe(1);
    expect(r.byTier.STALE_730).toBe(1);
  });

  it('honors custom threshold', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      thresholdDays: 90,
      arInvoices: [ar({ invoiceDate: '2026-01-01' })], // 116 days
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts oldest first', () => {
    const r = buildArWriteOffCandidates({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'newer-stale', invoiceDate: '2025-09-01' }),
        ar({ id: 'oldest', invoiceDate: '2024-01-01' }),
      ],
    });
    expect(r.rows[0]?.invoiceId).toBe('oldest');
  });
});
