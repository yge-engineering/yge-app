import { describe, it, expect } from 'vitest';
import {
  buildGlPostingStatus,
  type GlPostingInvoiceInput,
  type GlPostingJournalEntryInput,
} from './gl-posting-status';

const ar = (id: string, n: string, total: number, customerName = 'Acme'): GlPostingInvoiceInput => ({
  id,
  invoiceNumber: n,
  totalCents: total,
  status: 'SENT',
  customerName,
});
const ap = (id: string, n: string, total: number, vendorName = 'Supplier'): GlPostingInvoiceInput => ({
  id,
  invoiceNumber: n,
  totalCents: total,
  status: 'APPROVED',
  vendorName,
});
const je = (
  id: string,
  source: string,
  sourceRef: string,
  status: string,
): GlPostingJournalEntryInput => ({ id, source, sourceRef, status });

describe('buildGlPostingStatus', () => {
  it('classifies each invoice as posted / draft / unposted', () => {
    const arInvoices = [
      ar('ar1', '1001', 10000),
      ar('ar2', '1002', 20000),
      ar('ar3', '1003', 30000),
      ar('ar4', '1004', 40000),
    ];
    const apInvoices = [ap('ap1', '9001', 5000), ap('ap2', '9002', 6000)];
    const entries = [
      je('je1', 'AR_INVOICE', 'ar1', 'POSTED'),
      je('je2', 'AR_INVOICE', 'ar2', 'DRAFT'),
      je('je3', 'AR_INVOICE', 'ar4', 'VOIDED'), // voided -> ignored
      je('je4', 'AP_INVOICE', 'ap1', 'POSTED'),
      je('je5', 'MANUAL', 'ar3', 'POSTED'), // wrong source -> ignored
    ];

    const out = buildGlPostingStatus(arInvoices, apInvoices, entries);

    expect(out.arPosted).toBe(1);
    expect(out.arDraft).toBe(1);
    expect(out.arUnposted).toBe(2); // ar3 (no JE) + ar4 (voided only)
    expect(out.apPosted).toBe(1);
    expect(out.apDraft).toBe(0);
    expect(out.apUnposted).toBe(1);
    expect(out.unpostedTotalCents).toBe(30000 + 40000 + 6000);

    const byId = new Map(out.rows.map((r) => [r.invoiceId, r]));
    expect(byId.get('ar1')?.glState).toBe('POSTED');
    expect(byId.get('ar1')?.journalEntryId).toBe('je1');
    expect(byId.get('ar2')?.glState).toBe('DRAFT');
    expect(byId.get('ar3')?.glState).toBe('UNPOSTED');
    expect(byId.get('ar4')?.glState).toBe('UNPOSTED');
    expect(byId.get('ap1')?.party).toBe('Supplier');
  });

  it('prefers a posted entry over a draft for the same invoice', () => {
    const out = buildGlPostingStatus(
      [ar('ar1', '1001', 10000)],
      [],
      [
        je('d1', 'AR_INVOICE', 'ar1', 'DRAFT'),
        je('p1', 'AR_INVOICE', 'ar1', 'POSTED'),
      ],
    );
    expect(out.rows[0]?.glState).toBe('POSTED');
    expect(out.rows[0]?.journalEntryId).toBe('p1');
  });

  it('sorts unposted first, then draft, then posted', () => {
    const out = buildGlPostingStatus(
      [ar('ar1', '1001', 10000), ar('ar2', '1002', 20000), ar('ar3', '1003', 30000)],
      [],
      [
        je('p', 'AR_INVOICE', 'ar1', 'POSTED'),
        je('d', 'AR_INVOICE', 'ar2', 'DRAFT'),
      ],
    );
    expect(out.rows.map((r) => r.glState)).toEqual(['UNPOSTED', 'DRAFT', 'POSTED']);
  });

  it('returns a zeroed summary for no invoices', () => {
    const out = buildGlPostingStatus([], [], []);
    expect(out.rows).toHaveLength(0);
    expect(out.unpostedTotalCents).toBe(0);
    expect(out.arUnposted).toBe(0);
    expect(out.apPosted).toBe(0);
  });
});
