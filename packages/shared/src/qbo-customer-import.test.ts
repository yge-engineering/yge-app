import { describe, expect, it } from 'vitest';
import {
  buildQboCustomerImport,
  customerRowsFromCsv,
  inferCustomerKind,
} from './qbo-customer-import';

describe('inferCustomerKind', () => {
  it('detects state agencies', () => {
    expect(inferCustomerKind('CAL FIRE')).toBe('STATE_AGENCY');
    expect(inferCustomerKind('Caltrans District 2')).toBe('STATE_AGENCY');
  });
  it('detects county / city / district', () => {
    expect(inferCustomerKind('County of Shasta')).toBe('COUNTY');
    expect(inferCustomerKind('City of Redding')).toBe('CITY');
    expect(inferCustomerKind('Anderson Fire Protection District')).toBe('SPECIAL_DISTRICT');
  });
  it('detects private owners by entity suffix', () => {
    expect(inferCustomerKind('Acme Construction Inc')).toBe('PRIVATE_OWNER');
  });
  it('falls back to OTHER', () => {
    expect(inferCustomerKind('John Smith')).toBe('OTHER');
  });
});

describe('customerRowsFromCsv', () => {
  it('parses a typical QBO customer export', () => {
    const csv =
      'Customer,Company,Full Name,Phone,Email,Billing Street,Billing City,Billing State,Billing ZIP,Terms\n' +
      'Shasta County,County of Shasta,Jane Doe,530-555-1000,jane@co.shasta.ca.us,1450 Court St,Redding,CA,96001,Net 30\n';
    const rows = customerRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      displayName: 'Shasta County',
      companyName: 'County of Shasta',
      contactName: 'Jane Doe',
      phone: '530-555-1000',
      city: 'Redding',
      state: 'CA',
      zip: '96001',
      terms: 'Net 30',
    });
  });

  it('tolerates a minimal Customer/Email export', () => {
    const csv = 'Customer,Email\nAcme LLC,ap@acme.com\n';
    const rows = customerRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe('Acme LLC');
    expect(rows[0]!.email).toBe('ap@acme.com');
  });

  it('skips blank rows', () => {
    const csv = 'Customer,Company\nReal Co,Real Co\n,\n';
    expect(customerRowsFromCsv(csv)).toHaveLength(1);
  });
});

describe('buildQboCustomerImport', () => {
  it('prefers company name as legalName and uses display as DBA when different', () => {
    const res = buildQboCustomerImport([
      { displayName: 'Shasta County', companyName: 'County of Shasta' },
    ]);
    expect(res.customers).toHaveLength(1);
    expect(res.customers[0]).toMatchObject({
      legalName: 'County of Shasta',
      dbaName: 'Shasta County',
      kind: 'COUNTY',
    });
  });

  it('omits DBA when display equals company', () => {
    const res = buildQboCustomerImport([
      { displayName: 'Acme LLC', companyName: 'Acme LLC' },
    ]);
    expect(res.customers[0]!.dbaName).toBeUndefined();
  });

  it('falls back to display name when there is no company', () => {
    const res = buildQboCustomerImport([{ displayName: 'John Smith' }]);
    expect(res.customers[0]!.legalName).toBe('John Smith');
    expect(res.customers[0]!.kind).toBe('OTHER');
  });

  it('dedupes by legal name (case-insensitive) with a warning', () => {
    const res = buildQboCustomerImport([
      { displayName: 'Acme', companyName: 'Acme LLC' },
      { displayName: 'Acme 2', companyName: 'acme llc' },
    ]);
    expect(res.customers).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });

  it('carries contact + address + terms across', () => {
    const res = buildQboCustomerImport([
      {
        displayName: 'Acme',
        companyName: 'Acme LLC',
        contactName: 'Jane',
        phone: '555',
        email: 'a@b.com',
        billingLine1: '1 Main St',
        city: 'Redding',
        state: 'CA',
        zip: '96001',
        terms: 'Net 45',
      },
    ]);
    expect(res.customers[0]).toMatchObject({
      contactName: 'Jane',
      phone: '555',
      email: 'a@b.com',
      billingAddressLine: '1 Main St',
      city: 'Redding',
      state: 'CA',
      zip: '96001',
      paymentTerms: 'Net 45',
    });
  });
});
