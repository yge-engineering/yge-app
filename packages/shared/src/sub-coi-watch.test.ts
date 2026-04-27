import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildSubCoiWatch } from './sub-coi-watch';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Subs LLC',
    kind: 'SUBCONTRACTOR',
    w9OnFile: false,
    is1099Reportable: true,
    coiOnFile: true,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Subs LLC',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_000,
    paidCents: 100_000,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildSubCoiWatch', () => {
  it('only considers SUBCONTRACTOR vendors', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v1', kind: 'SUPPLIER' }),
        vendor({ id: 'v2', kind: 'SUBCONTRACTOR' }),
      ],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorId).toBe('v2');
  });

  it('flags NO_COI when coiOnFile is false', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiOnFile: false })],
      apInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('NO_COI');
  });

  it('flags CURRENT when expiry is more than 30 days out', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiExpiresOn: '2026-09-01' })],
      apInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('CURRENT');
  });

  it('flags EXPIRING_SOON when expiry is within 30 days', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiExpiresOn: '2026-05-15' })],
      apInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('EXPIRING_SOON');
    expect(r.rows[0]?.daysToExpiry).toBe(18);
  });

  it('flags EXPIRED when coiExpiresOn has passed', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiExpiresOn: '2026-03-01' })],
      apInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('EXPIRED');
    expect(r.rows[0]?.daysToExpiry).toBeLessThan(0);
  });

  it('treats coiOnFile=true with no coiExpiresOn as CURRENT', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiOnFile: true, coiExpiresOn: undefined })],
      apInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('CURRENT');
    expect(r.rows[0]?.daysToExpiry).toBe(null);
  });

  it('rolls up unpaid exposure from PENDING + APPROVED invoices', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiOnFile: false })],
      apInvoices: [
        ap({ id: 'ap-1', status: 'PENDING', totalCents: 50_000_00, paidCents: 0 }),
        ap({ id: 'ap-2', status: 'APPROVED', totalCents: 20_000_00, paidCents: 5_000_00 }),
        ap({ id: 'ap-3', status: 'DRAFT', totalCents: 99_000_00, paidCents: 0 }),
      ],
    });
    // 50K + (20K - 5K) = 65K
    expect(r.rows[0]?.unpaidExposureCents).toBe(65_000_00);
    expect(r.rollup.blockedExposureCents).toBe(65_000_00);
  });

  it('rolls up recent paid (within YTD by default)', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [vendor({ coiOnFile: false })],
      apInvoices: [
        ap({ id: 'ap-1', invoiceDate: '2026-02-01', paidCents: 10_000_00 }),
        ap({ id: 'ap-2', invoiceDate: '2025-12-15', paidCents: 99_000_00 }), // before YTD
      ],
    });
    expect(r.rows[0]?.recentPaidCents).toBe(10_000_00);
    expect(r.rollup.paidWhileUninsuredCents).toBe(10_000_00);
  });

  it('respects custom recentSince window', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      recentSince: '2026-03-01',
      vendors: [vendor({ coiOnFile: false })],
      apInvoices: [
        ap({ id: 'ap-1', invoiceDate: '2026-02-15', paidCents: 99_000_00 }), // before window
        ap({ id: 'ap-2', invoiceDate: '2026-04-01', paidCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.recentPaidCents).toBe(5_000_00);
  });

  it('matches AP invoices to vendor by DBA name', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [
        vendor({
          id: 'vnd-7',
          legalName: 'Big Company LLC',
          dbaName: 'BigCo',
          coiOnFile: false,
        }),
      ],
      apInvoices: [
        ap({ vendorName: 'BigCo', status: 'PENDING', totalCents: 10_000_00, paidCents: 0 }),
      ],
    });
    expect(r.rows[0]?.unpaidExposureCents).toBe(10_000_00);
  });

  it('rolls up tier counts and sorts EXPIRED first', () => {
    const r = buildSubCoiWatch({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-current', legalName: 'Current Sub', coiExpiresOn: '2026-09-01' }),
        vendor({ id: 'v-soon', legalName: 'Soon Sub', coiExpiresOn: '2026-05-15' }),
        vendor({ id: 'v-expired', legalName: 'Expired Sub', coiExpiresOn: '2026-01-01' }),
        vendor({ id: 'v-none', legalName: 'No COI Sub', coiOnFile: false }),
      ],
      apInvoices: [],
    });
    expect(r.rollup.current).toBe(1);
    expect(r.rollup.expiringSoon).toBe(1);
    expect(r.rollup.expired).toBe(1);
    expect(r.rollup.noCoi).toBe(1);
    expect(r.rows[0]?.vendorId).toBe('v-expired');
  });
});
