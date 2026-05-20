import { describe, expect, it } from 'vitest';
import { apRowsFromCsv, buildQboApImport } from './qbo-ap-import';

describe('apRowsFromCsv', () => {
  it('parses an A/P aging detail export', () => {
    const csv =
      'Date,Num,Vendor,Due Date,Open Balance\n' +
      '02/01/2026,B-77,Apex Grading Inc,03/03/2026,"$8,200.00"\n';
    const rows = apRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vendorName: 'Apex Grading Inc',
      invoiceNumber: 'B-77',
      billDate: '02/01/2026',
      dueDate: '03/03/2026',
      openBalance: '$8,200.00',
    });
  });
});

describe('buildQboApImport', () => {
  it('maps an unpaid bill to an APPROVED open payable', () => {
    const res = buildQboApImport([
      {
        vendorName: 'Apex Grading Inc',
        invoiceNumber: 'B-77',
        billDate: '02/01/2026',
        dueDate: '03/03/2026',
        openBalance: '$8,200.00',
      },
    ]);
    expect(res.bills).toHaveLength(1);
    expect(res.bills[0]).toMatchObject({
      vendorName: 'Apex Grading Inc',
      invoiceNumber: 'B-77',
      invoiceDate: '2026-02-01',
      dueDate: '2026-03-03',
      totalCents: 820000,
      paidCents: 0,
      status: 'APPROVED',
    });
    expect(res.totalOpenCents).toBe(820000);
  });

  it('leaves invoiceNumber unset when blank (AP allows it)', () => {
    const res = buildQboApImport([
      { vendorName: 'Acme', billDate: '01/01/2026', openBalance: '100' },
    ]);
    expect(res.bills[0]!.invoiceNumber).toBeUndefined();
  });

  it('skips zero / negative / blank balances', () => {
    const res = buildQboApImport([
      { vendorName: 'A', invoiceNumber: '1', billDate: '01/01/2026', openBalance: '0' },
      { vendorName: 'B', invoiceNumber: '2', billDate: '01/01/2026', openBalance: '(50)' },
      { vendorName: 'C', invoiceNumber: '3', billDate: '01/01/2026', openBalance: '' },
    ]);
    expect(res.bills).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('skips rows with an unparseable date', () => {
    const res = buildQboApImport([
      { vendorName: 'A', invoiceNumber: '1', billDate: 'last week', openBalance: '100' },
    ]);
    expect(res.bills).toHaveLength(0);
  });

  it('dedupes by vendor + bill number (or vendor+date+amount when no number)', () => {
    const withNum = buildQboApImport([
      { vendorName: 'Acme', invoiceNumber: '1', billDate: '01/01/2026', openBalance: '100' },
      { vendorName: 'acme', invoiceNumber: '1', billDate: '01/02/2026', openBalance: '200' },
    ]);
    expect(withNum.bills).toHaveLength(1);

    const noNum = buildQboApImport([
      { vendorName: 'Acme', billDate: '01/01/2026', openBalance: '100' },
      { vendorName: 'Acme', billDate: '01/01/2026', openBalance: '100' },
    ]);
    expect(noNum.bills).toHaveLength(1);
  });
});
