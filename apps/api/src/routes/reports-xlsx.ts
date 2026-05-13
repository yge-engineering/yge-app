// /api/reports/*.xlsx — Excel exports of the analysis reports.
//
// All endpoints stream a real .xlsx workbook (Brook can open in
// Excel + pivot). They re-run the canonical builders against
// production data so the workbook matches what the web page shows.

import { Router } from 'express';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import {
  buildArAgingReport,
  buildCustomerConcentration,
  buildVendorSpendReport,
} from '@yge/shared';
import { prisma } from '@yge/db';

export const reportsXlsxRouter = Router();

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ytdStart(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

function streamXlsx(res: import('express').Response, wb: XLSX.WorkBook, filename: string): void {
  const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

function isIso(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

reportsXlsxRouter.get('/vendor-spend.xlsx', async (req, res, next) => {
  try {
    const start = isIso(req.query.start) ? req.query.start : ytdStart();
    const end = isIso(req.query.end) ? req.query.end : toYmd(new Date());
    // Pull AP invoices from prisma (data column JSON has the full ApInvoice).
    const rows = await prisma.apInvoice.findMany({ where: { deletedAt: null } });
    const apInvoices = rows
      .map((r) => r.data)
      .filter((d) => d !== null && typeof d === 'object' && !Array.isArray(d))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => d as unknown as any);
    const report = buildVendorSpendReport({ start, end, apInvoices });
    const rowsOut = report.rows.map((r, i) => ({
      '#': i + 1,
      Vendor: r.vendorName,
      Invoices: r.invoiceCount,
      'Total spend ($)': (r.totalSpendCents / 100).toFixed(2),
      'Paid ($)': (r.totalPaidCents / 100).toFixed(2),
      'Outstanding ($)': (r.outstandingCents / 100).toFixed(2),
      '% of period': (r.shareOfPeriod * 100).toFixed(2) + '%',
      'First invoice': r.firstInvoiceOn,
      'Last invoice': r.lastInvoiceOn,
    }));
    const ws = XLSX.utils.json_to_sheet(rowsOut);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor spend');
    // Summary sheet.
    const summary = XLSX.utils.json_to_sheet([
      { Metric: 'Period start', Value: start },
      { Metric: 'Period end', Value: end },
      { Metric: 'Total spend ($)', Value: (report.totalSpendCents / 100).toFixed(2) },
      { Metric: 'Total paid ($)', Value: (report.totalPaidCents / 100).toFixed(2) },
      { Metric: 'Total outstanding ($)', Value: (report.totalOutstandingCents / 100).toFixed(2) },
      { Metric: 'Vendor count', Value: report.vendorCount },
      { Metric: 'Top-5 concentration', Value: (report.top5SharePct * 100).toFixed(2) + '%' },
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
    streamXlsx(res, wb, `vendor-spend-${start}-to-${end}.xlsx`);
  } catch (err) {
    next(err);
  }
});

reportsXlsxRouter.get('/customer-concentration.xlsx', async (req, res, next) => {
  try {
    const start = isIso(req.query.start) ? req.query.start : ytdStart();
    const end = isIso(req.query.end) ? req.query.end : toYmd(new Date());
    const rows = await prisma.arInvoice.findMany({ where: { deletedAt: null } });
    const arInvoices = rows
      .map((r) => r.data)
      .filter((d) => d !== null && typeof d === 'object' && !Array.isArray(d))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => d as unknown as any);
    const report = buildCustomerConcentration({ start, end, arInvoices });
    const rowsOut = report.rows.map((r, i) => ({
      '#': i + 1,
      Customer: r.customerName,
      Invoices: r.invoiceCount,
      Jobs: r.jobCount,
      'Billed ($)': (r.billedCents / 100).toFixed(2),
      'Collected ($)': (r.collectedCents / 100).toFixed(2),
      '% of period': (r.shareOfPeriod * 100).toFixed(2) + '%',
    }));
    const ws = XLSX.utils.json_to_sheet(rowsOut);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer concentration');
    const summary = XLSX.utils.json_to_sheet([
      { Metric: 'Period start', Value: start },
      { Metric: 'Period end', Value: end },
      { Metric: 'Total billed ($)', Value: (report.totalBilledCents / 100).toFixed(2) },
      { Metric: 'Total collected ($)', Value: (report.totalCollectedCents / 100).toFixed(2) },
      { Metric: 'Top-1 share', Value: (report.top1SharePct * 100).toFixed(2) + '%' },
      { Metric: 'Top-3 share', Value: (report.top3SharePct * 100).toFixed(2) + '%' },
      { Metric: 'Top-5 share', Value: (report.top5SharePct * 100).toFixed(2) + '%' },
      { Metric: 'HHI', Value: Math.round(report.hhi) },
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
    streamXlsx(res, wb, `customer-concentration-${start}-to-${end}.xlsx`);
  } catch (err) {
    next(err);
  }
});

reportsXlsxRouter.get('/aging.xlsx', async (req, res, next) => {
  try {
    const asOf = isIso(req.query.asOf) ? req.query.asOf : toYmd(new Date());
    const rows = await prisma.arInvoice.findMany({ where: { deletedAt: null } });
    const arInvoices = rows
      .map((r) => r.data)
      .filter((d) => d !== null && typeof d === 'object' && !Array.isArray(d))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d) => d as unknown as any);
    const ar = buildArAgingReport({ asOf, arInvoices });
    const rowsOut = ar.rows.map((r) => ({
      'Customer': r.partyName,
      'Invoice #': r.invoiceNumber,
      'Invoice date': r.invoiceDate,
      'Due date': r.effectiveDueDate,
      'Total ($)': (r.totalCents / 100).toFixed(2),
      'Paid ($)': (r.paidCents / 100).toFixed(2),
      'Open ($)': (r.openCents / 100).toFixed(2),
      'Days overdue': r.daysOverdue,
      'Bucket': r.bucket,
    }));
    const ws = XLSX.utils.json_to_sheet(rowsOut);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AR aging');
    const summary = XLSX.utils.json_to_sheet([
      { Metric: 'As of', Value: asOf },
      { Metric: 'Total open ($)', Value: (ar.totalOpenCents / 100).toFixed(2) },
      { Metric: '0-30 ($)', Value: ((ar.bucketTotals['0-30'] ?? 0) / 100).toFixed(2) },
      { Metric: '31-60 ($)', Value: ((ar.bucketTotals['31-60'] ?? 0) / 100).toFixed(2) },
      { Metric: '61-90 ($)', Value: ((ar.bucketTotals['61-90'] ?? 0) / 100).toFixed(2) },
      { Metric: '90+ ($)', Value: ((ar.bucketTotals['90+'] ?? 0) / 100).toFixed(2) },
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
    streamXlsx(res, wb, `ar-aging-${asOf}.xlsx`);
  } catch (err) {
    next(err);
  }
});
