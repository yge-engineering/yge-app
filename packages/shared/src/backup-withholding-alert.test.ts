import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import {
  BACKUP_WITHHOLDING_RATE,
  buildBackupWithholdingAlert,
} from './backup-withholding-alert';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-00000001',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Trucking LLC',
    kind: 'TRUCKING',
    w9OnFile: false,
    is1099Reportable: true,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-00000001',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    vendorName: 'Acme Trucking LLC',
    invoiceDate: '2026-02-01',
    lineItems: [],
    totalCents: 100_000,
    paidCents: 100_000,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildBackupWithholdingAlert', () => {
  it('flags vendor with no W-9 over threshold (NO_W9)', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'vnd-1', w9OnFile: false })],
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Acme Trucking LLC', paidCents: 700_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.reason).toBe('NO_W9');
    expect(r.rows[0]?.vendorId).toBe('vnd-1');
    expect(r.rows[0]?.ytdPaidCents).toBe(700_00);
  });

  it('flags vendor with stale W-9 (STALE_W9)', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [
        vendor({
          id: 'vnd-2',
          w9OnFile: true,
          w9CollectedOn: '2022-01-01',
          taxId: '12-3456789',
        }),
      ],
      apInvoices: [
        ap({ id: 'ap-2', vendorName: 'Acme Trucking LLC', paidCents: 800_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.reason).toBe('STALE_W9');
  });

  it('flags vendor with W-9 but no tax id (NO_TAX_ID)', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [
        vendor({
          id: 'vnd-3',
          w9OnFile: true,
          w9CollectedOn: '2025-06-01',
          taxId: '',
        }),
      ],
      apInvoices: [
        ap({ id: 'ap-3', vendorName: 'Acme Trucking LLC', paidCents: 900_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.reason).toBe('NO_TAX_ID');
  });

  it('skips vendor below threshold', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'vnd-4' })],
      apInvoices: [
        ap({ id: 'ap-4', vendorName: 'Acme Trucking LLC', paidCents: 500_00 }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips vendor that is not 1099-reportable', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'vnd-5', is1099Reportable: false, w9OnFile: false }),
      ],
      apInvoices: [
        ap({ id: 'ap-5', vendorName: 'Acme Trucking LLC', paidCents: 5_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('excludes DRAFT and REJECTED invoices from YTD spend', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'vnd-6' })],
      apInvoices: [
        ap({ id: 'ap-6a', vendorName: 'Acme Trucking LLC', paidCents: 700_00, status: 'DRAFT' }),
        ap({ id: 'ap-6b', vendorName: 'Acme Trucking LLC', paidCents: 700_00, status: 'REJECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('excludes invoices outside the year', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'vnd-7' })],
      apInvoices: [
        ap({ id: 'ap-7', vendorName: 'Acme Trucking LLC', invoiceDate: '2025-12-15', paidCents: 700_00 }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('computes 24% withholding exposure', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [vendor({ id: 'vnd-8' })],
      apInvoices: [
        ap({ id: 'ap-8', vendorName: 'Acme Trucking LLC', paidCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.withholdingExposureCents).toBe(
      Math.round(10_000_00 * BACKUP_WITHHOLDING_RATE),
    );
    expect(r.totalExposureCents).toBe(r.rows[0]?.withholdingExposureCents);
  });

  it('sorts by exposure desc', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'vnd-a', legalName: 'Alpha LLC' }),
        vendor({ id: 'vnd-b', legalName: 'Beta LLC' }),
      ],
      apInvoices: [
        ap({ id: 'ap-a', vendorName: 'Alpha LLC', paidCents: 1_000_00 }),
        ap({ id: 'ap-b', vendorName: 'Beta LLC', paidCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('vnd-b');
    expect(r.rows[1]?.vendorId).toBe('vnd-a');
  });

  it('matches by DBA name as well as legal name', () => {
    const r = buildBackupWithholdingAlert({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'vnd-9', legalName: 'Big Company LLC', dbaName: 'BigCo' }),
      ],
      apInvoices: [
        ap({ id: 'ap-9', vendorName: 'BigCo', paidCents: 700_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorId).toBe('vnd-9');
  });
});
