import { describe, expect, it } from 'vitest';
import {
  buildQboVendorImport,
  inferVendorKind,
  mapVendorPaymentTerms,
  vendorRowsFromCsv,
} from './qbo-vendor-import';

describe('inferVendorKind', () => {
  it('detects common kinds', () => {
    expect(inferVendorKind('Redding Trucking')).toBe('TRUCKING');
    expect(inferVendorKind('United Rentals')).toBe('EQUIPMENT_RENTAL');
    expect(inferVendorKind('North State Engineering')).toBe('PROFESSIONAL');
    expect(inferVendorKind('PG&E')).toBe('UTILITY');
    expect(inferVendorKind('County of Shasta Permits')).toBe('GOVERNMENT');
    expect(inferVendorKind('Tehama Ready Mix')).toBe('SUPPLIER');
    expect(inferVendorKind('Apex Grading & Excavation')).toBe('SUBCONTRACTOR');
    expect(inferVendorKind('Bob Jones')).toBe('OTHER');
  });
});

describe('mapVendorPaymentTerms', () => {
  it('maps net terms', () => {
    expect(mapVendorPaymentTerms('Net 30')).toBe('NET_30');
    expect(mapVendorPaymentTerms('net15')).toBe('NET_15');
    expect(mapVendorPaymentTerms('NET 60')).toBe('NET_60');
  });
  it('maps non-net terms', () => {
    expect(mapVendorPaymentTerms('Due on receipt')).toBe('DUE_ON_RECEIPT');
    expect(mapVendorPaymentTerms('COD')).toBe('COD');
    expect(mapVendorPaymentTerms('Prepaid')).toBe('PREPAID');
  });
  it('returns OTHER for unrecognized, undefined for blank', () => {
    expect(mapVendorPaymentTerms('Weird Terms')).toBe('OTHER');
    expect(mapVendorPaymentTerms(undefined)).toBeUndefined();
  });
});

describe('vendorRowsFromCsv', () => {
  it('parses a typical QBO vendor export', () => {
    const csv =
      'Vendor,Company,Full Name,Phone,Email,Street,City,State,ZIP,Terms,Account No.,Tax ID,Track 1099\n' +
      'Apex Grading,Apex Grading Inc,Sam Apex,530-555-2000,sam@apex.com,12 Quarry Rd,Anderson,CA,96007,Net 30,YGE-01,77-1234567,Yes\n';
    const rows = vendorRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      displayName: 'Apex Grading',
      companyName: 'Apex Grading Inc',
      taxId: '77-1234567',
      track1099: 'Yes',
      terms: 'Net 30',
    });
  });
});

describe('buildQboVendorImport', () => {
  it('maps legal/DBA, kind, terms, tax id, 1099 flag', () => {
    const res = buildQboVendorImport([
      {
        displayName: 'Apex Grading',
        companyName: 'Apex Grading Inc',
        terms: 'Net 30',
        taxId: '77-1234567',
        track1099: 'Yes',
      },
    ]);
    expect(res.vendors).toHaveLength(1);
    expect(res.vendors[0]).toMatchObject({
      legalName: 'Apex Grading Inc',
      dbaName: 'Apex Grading',
      kind: 'SUBCONTRACTOR',
      paymentTerms: 'NET_30',
      taxId: '77-1234567',
      is1099Reportable: true,
    });
  });

  it('defaults 1099 from kind when no column present', () => {
    const sub = buildQboVendorImport([{ displayName: 'Apex Excavation' }]);
    expect(sub.vendors[0]!.is1099Reportable).toBe(true);
    const supplier = buildQboVendorImport([{ displayName: 'Tehama Ready Mix' }]);
    expect(supplier.vendors[0]!.is1099Reportable).toBe(false);
  });

  it('honors an explicit 1099 = No even for a sub', () => {
    const res = buildQboVendorImport([
      { displayName: 'Apex Excavation', track1099: 'No' },
    ]);
    expect(res.vendors[0]!.is1099Reportable).toBe(false);
  });

  it('dedupes by legal name with a warning', () => {
    const res = buildQboVendorImport([
      { displayName: 'A', companyName: 'Acme Inc' },
      { displayName: 'A2', companyName: 'acme inc' },
    ]);
    expect(res.vendors).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });
});
