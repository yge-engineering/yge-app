import { describe, expect, it } from 'vitest';
import { arRowsFromCsv, buildQboArImport, QBO_MIGRATION_JOB_ID } from './qbo-ar-import';

describe('arRowsFromCsv', () => {
  it('parses an A/R aging detail export', () => {
    const csv =
      'Date,Num,Customer,Due Date,Open Balance\n' +
      '03/15/2026,1001,County of Shasta,04/14/2026,"$12,500.00"\n';
    const rows = arRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      customerName: 'County of Shasta',
      invoiceNumber: '1001',
      invoiceDate: '03/15/2026',
      dueDate: '04/14/2026',
      openBalance: '$12,500.00',
    });
  });

  it('skips total lines with no customer + no balance', () => {
    const csv = 'Date,Num,Customer,Open Balance\n03/15/2026,1001,Acme,100.00\n,,,\n';
    expect(arRowsFromCsv(csv)).toHaveLength(1);
  });
});

describe('buildQboArImport', () => {
  it('maps an open invoice to an open AR record on the migration job', () => {
    const res = buildQboArImport([
      {
        customerName: 'County of Shasta',
        invoiceNumber: '1001',
        invoiceDate: '03/15/2026',
        dueDate: '04/14/2026',
        openBalance: '$12,500.00',
      },
    ]);
    expect(res.invoices).toHaveLength(1);
    expect(res.invoices[0]).toMatchObject({
      jobId: QBO_MIGRATION_JOB_ID,
      invoiceNumber: '1001',
      customerName: 'County of Shasta',
      invoiceDate: '2026-03-15',
      dueDate: '2026-04-14',
      totalCents: 1250000,
      paidCents: 0,
      status: 'SENT',
    });
    expect(res.totalOpenCents).toBe(1250000);
  });

  it('honors a custom jobId', () => {
    const res = buildQboArImport(
      [{ customerName: 'Acme', invoiceNumber: '1', invoiceDate: '01/01/2026', openBalance: '100' }],
      { jobId: 'job-123' },
    );
    expect(res.invoices[0]!.jobId).toBe('job-123');
  });

  it('synthesizes an invoice number when blank', () => {
    const res = buildQboArImport([
      { customerName: 'Acme', invoiceDate: '01/01/2026', openBalance: '100' },
    ]);
    expect(res.invoices[0]!.invoiceNumber).toMatch(/^QBO-AR-\d{4}$/);
  });

  it('skips zero / negative / blank balances with a warning', () => {
    const res = buildQboArImport([
      { customerName: 'A', invoiceNumber: '1', invoiceDate: '01/01/2026', openBalance: '0' },
      { customerName: 'B', invoiceNumber: '2', invoiceDate: '01/01/2026', openBalance: '(50.00)' },
      { customerName: 'C', invoiceNumber: '3', invoiceDate: '01/01/2026', openBalance: '' },
    ]);
    expect(res.invoices).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('skips rows with an unparseable date', () => {
    const res = buildQboArImport([
      { customerName: 'A', invoiceNumber: '1', invoiceDate: 'March 1', openBalance: '100' },
    ]);
    expect(res.invoices).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes('not understood'))).toBe(true);
  });

  it('dedupes by customer + invoice number', () => {
    const res = buildQboArImport([
      { customerName: 'Acme', invoiceNumber: '1', invoiceDate: '01/01/2026', openBalance: '100' },
      { customerName: 'acme', invoiceNumber: '1', invoiceDate: '01/02/2026', openBalance: '200' },
    ]);
    expect(res.invoices).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });
});
