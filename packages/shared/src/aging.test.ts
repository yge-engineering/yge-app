import { describe, expect, it } from 'vitest';
import { buildArAgingReport, buildApAgingReport } from './aging';
import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-01-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme Materials',
    invoiceDate: '2026-01-01',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

describe('buildArAgingReport', () => {
  it('skips DRAFT, PAID, WRITTEN_OFF — only collectible balances count', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'ar-draft', status: 'DRAFT' }),
        ar({ id: 'ar-paid', status: 'PAID', paidCents: 100_00 }),
        ar({ id: 'ar-wo', status: 'WRITTEN_OFF' }),
        ar({ id: 'ar-sent', status: 'SENT' }),
      ],
    });
    expect(r.rows.map((x) => x.invoiceId)).toEqual(['ar-sent']);
  });

  it('skips zero-balance rows even when status is PARTIALLY_PAID', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({
          id: 'ar-fully',
          status: 'PARTIALLY_PAID',
          totalCents: 100_00,
          paidCents: 100_00,
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('synthesizes a Net-30 due date when invoice has none', () => {
    const r = buildArAgingReport({
      asOf: '2026-03-01',
      arInvoices: [ar({ id: 'ar-1', invoiceDate: '2026-01-15', dueDate: undefined })],
    });
    expect(r.rows[0]?.effectiveDueDate).toBe('2026-02-14');
    expect(r.rows[0]?.dueDateSynthesized).toBe(true);
  });

  it('uses stated dueDate when provided, no synthesis', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-01',
      arInvoices: [ar({ invoiceDate: '2026-01-01', dueDate: '2026-03-15' })],
    });
    expect(r.rows[0]?.effectiveDueDate).toBe('2026-03-15');
    expect(r.rows[0]?.dueDateSynthesized).toBe(false);
    expect(r.rows[0]?.daysOverdue).toBe(17);
  });

  it('not-yet-due invoices land in 0-30 bucket with daysOverdue=0', () => {
    const r = buildArAgingReport({
      asOf: '2026-03-01',
      arInvoices: [ar({ invoiceDate: '2026-02-15', dueDate: '2026-04-15' })],
    });
    expect(r.rows[0]?.daysOverdue).toBe(0);
    expect(r.rows[0]?.bucket).toBe('0-30');
  });

  it('correctly buckets each cutoff edge', () => {
    // Due 2026-01-01, asOf 2026-02-01 → 31 days → 31-60 bucket
    // Due 2026-01-01, asOf 2026-03-03 → 61 days → 61-90 bucket
    // Due 2026-01-01, asOf 2026-04-02 → 91 days → 90+ bucket
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'ar-1', dueDate: '2026-04-10' }), // 5 days → 0-30
        ar({ id: 'ar-2', dueDate: '2026-03-01' }), // 45 → 31-60
        ar({ id: 'ar-3', dueDate: '2026-02-01' }), // 73 → 61-90
        ar({ id: 'ar-4', dueDate: '2026-01-01' }), // 104 → 90+
      ],
    });
    const byId = new Map(r.rows.map((x) => [x.invoiceId, x]));
    expect(byId.get('ar-1')?.bucket).toBe('0-30');
    expect(byId.get('ar-2')?.bucket).toBe('31-60');
    expect(byId.get('ar-3')?.bucket).toBe('61-90');
    expect(byId.get('ar-4')?.bucket).toBe('90+');
  });

  it('sums openCents across rows + buckets', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'ar-a', dueDate: '2026-04-10', totalCents: 1_000_00, paidCents: 0 }),
        ar({ id: 'ar-b', dueDate: '2026-01-01', totalCents: 500_00, paidCents: 100_00 }),
      ],
    });
    expect(r.totalOpenCents).toBe(1_400_00);
    expect(r.bucketTotals['0-30']).toBe(1_000_00);
    expect(r.bucketTotals['90+']).toBe(400_00);
    expect(r.hasDangerBucket).toBe(true);
  });

  it('rolls up by customer, worst-90+-first then biggest open', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        // Cal Fire: small but in 90+
        ar({
          id: 'ar-cf',
          customerName: 'Cal Fire',
          dueDate: '2026-01-01', // 90+
          totalCents: 200_00,
        }),
        // Caltrans: huge but current
        ar({
          id: 'ar-ct',
          customerName: 'Caltrans',
          dueDate: '2026-04-10', // 0-30
          totalCents: 50_000_00,
        }),
      ],
    });
    expect(r.byParty[0]?.partyName).toBe('Cal Fire'); // 90+ wins
    expect(r.byParty[0]?.bucket90PlusCents).toBe(200_00);
    expect(r.byParty[1]?.partyName).toBe('Caltrans');
  });

  it('aggregates multiple invoices for one customer', () => {
    const r = buildArAgingReport({
      asOf: '2026-04-15',
      arInvoices: [
        ar({ id: 'ar-1', customerName: 'Cal Fire', dueDate: '2026-04-10', totalCents: 100_00 }),
        ar({ id: 'ar-2', customerName: 'Cal Fire', dueDate: '2026-01-01', totalCents: 200_00 }),
        ar({ id: 'ar-3', customerName: 'Cal Fire', dueDate: '2026-02-01', totalCents: 300_00 }),
      ],
    });
    const cf = r.byParty.find((p) => p.partyName === 'Cal Fire')!;
    expect(cf.invoiceCount).toBe(3);
    expect(cf.totalOpenCents).toBe(600_00);
    expect(cf.bucket0to30Cents).toBe(100_00);
    expect(cf.bucket61to90Cents).toBe(300_00);
    expect(cf.bucket90PlusCents).toBe(200_00);
    expect(cf.oldestDaysOverdue).toBeGreaterThanOrEqual(100);
  });
});

describe('buildApAgingReport', () => {
  it('skips DRAFT, REJECTED, PAID', () => {
    const r = buildApAgingReport({
      asOf: '2026-04-15',
      apInvoices: [
        ap({ id: 'api-1', status: 'DRAFT' }),
        ap({ id: 'api-2', status: 'REJECTED' }),
        ap({ id: 'api-3', status: 'PAID', paidCents: 100_00 }),
        ap({ id: 'api-4', status: 'APPROVED' }),
        ap({ id: 'api-5', status: 'PENDING' }),
      ],
    });
    const ids = r.rows.map((x) => x.invoiceId).sort();
    expect(ids).toEqual(['api-4', 'api-5']);
  });

  it('rolls up by vendor', () => {
    const r = buildApAgingReport({
      asOf: '2026-04-15',
      apInvoices: [
        ap({ id: 'api-1', vendorName: 'Granite Rock', dueDate: '2026-01-01', totalCents: 5_000_00 }),
        ap({ id: 'api-2', vendorName: 'Granite Rock', dueDate: '2026-04-10', totalCents: 1_000_00 }),
        ap({ id: 'api-3', vendorName: 'Local Tire', dueDate: '2026-04-10', totalCents: 200_00 }),
      ],
    });
    const granite = r.byParty.find((p) => p.partyName === 'Granite Rock')!;
    expect(granite.invoiceCount).toBe(2);
    expect(granite.bucket90PlusCents).toBe(5_000_00);
    expect(granite.bucket0to30Cents).toBe(1_000_00);
  });

  it('hasDangerBucket=false when nothing is in 90+', () => {
    const r = buildApAgingReport({
      asOf: '2026-04-15',
      apInvoices: [ap({ dueDate: '2026-04-10' })],
    });
    expect(r.hasDangerBucket).toBe(false);
  });
});
