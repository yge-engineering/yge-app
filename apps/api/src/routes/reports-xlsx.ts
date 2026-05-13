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

// GET /api/reports/cpr/:id.xlsx — export a CertifiedPayroll as a
// WH-347-style Excel workbook.
reportsXlsxRouter.get('/cpr/:id.xlsx', async (req, res, next) => {
  try {
    const Param = z.object({ id: z.string().min(1).max(120) });
    const parsed = Param.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Bad id' });
    }
    // CertifiedPayroll lives in JSON in CertifiedPayroll.data column.
    const row = await prisma.certifiedPayroll.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    });
    if (!row || !row.data) {
      return res.status(404).json({ error: 'CPR not found' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cpr = row.data as any;

    // Header sheet.
    const headerRows = [
      { Field: 'Job ID', Value: cpr.jobId ?? '' },
      { Field: 'Project number', Value: cpr.projectNumber ?? '' },
      { Field: 'Awarding agency', Value: cpr.awardingAgency ?? '' },
      { Field: 'Payroll number', Value: cpr.payrollNumber ?? '' },
      { Field: 'Final payroll', Value: cpr.isFinalPayroll ? 'YES' : 'No' },
      { Field: 'Week starting (Mon)', Value: cpr.weekStarting ?? '' },
      { Field: 'Week ending (Sun)', Value: cpr.weekEnding ?? '' },
      { Field: 'Status', Value: cpr.status ?? 'DRAFT' },
      { Field: 'Compliance signed', Value: cpr.complianceStatementSigned ? 'YES' : 'No' },
      { Field: 'Signed by employee id', Value: cpr.signedByEmployeeId ?? '' },
      { Field: 'Submitted at', Value: cpr.submittedAt ?? '' },
      { Field: 'Accepted at', Value: cpr.acceptedAt ?? '' },
    ];
    const headerWs = XLSX.utils.json_to_sheet(headerRows);

    // Employee detail sheet.
    interface CprRow {
      employeeId?: string;
      name?: string;
      classification?: string;
      classificationOverride?: string;
      ssnLast4?: string;
      dailyHours?: number[];
      straightHours?: number;
      overtimeHours?: number;
      hourlyRateCents?: number;
      fringeRateCents?: number;
      grossPayCents?: number;
      deductionsCents?: number;
      netPayCents?: number;
      note?: string;
    }
    const rows: CprRow[] = Array.isArray(cpr.rows) ? cpr.rows : [];
    const detailRows = rows.map((r) => ({
      Name: r.name ?? '',
      Classification: r.classificationOverride ?? r.classification ?? '',
      'SSN last-4': r.ssnLast4 ?? '',
      Mon: (r.dailyHours?.[0] ?? 0).toFixed(2),
      Tue: (r.dailyHours?.[1] ?? 0).toFixed(2),
      Wed: (r.dailyHours?.[2] ?? 0).toFixed(2),
      Thu: (r.dailyHours?.[3] ?? 0).toFixed(2),
      Fri: (r.dailyHours?.[4] ?? 0).toFixed(2),
      Sat: (r.dailyHours?.[5] ?? 0).toFixed(2),
      Sun: (r.dailyHours?.[6] ?? 0).toFixed(2),
      'Straight hrs': (r.straightHours ?? 0).toFixed(2),
      'OT hrs': (r.overtimeHours ?? 0).toFixed(2),
      'Hourly rate ($)': ((r.hourlyRateCents ?? 0) / 100).toFixed(2),
      'Fringe rate ($/hr)': ((r.fringeRateCents ?? 0) / 100).toFixed(2),
      'Gross ($)': ((r.grossPayCents ?? 0) / 100).toFixed(2),
      'Deductions ($)': ((r.deductionsCents ?? 0) / 100).toFixed(2),
      'Net pay ($)': ((r.netPayCents ?? 0) / 100).toFixed(2),
      Note: r.note ?? '',
    }));
    const detailWs = XLSX.utils.json_to_sheet(detailRows);

    // Statement of compliance.
    const sosRows = [
      { Line: 'STATEMENT OF COMPLIANCE' },
      { Line: '' },
      { Line: `I, the undersigned, am the authorized representative of Young General Engineering, Inc., and I do hereby state:` },
      { Line: `` },
      { Line: `(1) That I pay or supervise the payment of the persons employed by Young General Engineering, Inc. on the project named above; that during the payroll period commencing on ${cpr.weekStarting ?? ''} and ending on ${cpr.weekEnding ?? ''}, all persons employed on said project have been paid the full weekly wages earned;` },
      { Line: `` },
      { Line: `(2) That any payrolls otherwise under this contract required to be submitted for the above period are correct and complete;` },
      { Line: `` },
      { Line: `(3) That the wage rates paid to each laborer or mechanic are not less than the applicable wage rates contained in any wage determination incorporated into the contract.` },
      { Line: `` },
      { Line: `Signed by employee id: ${cpr.signedByEmployeeId ?? '(not signed)'}` },
      { Line: `Signed: ${cpr.complianceStatementSigned ? 'YES' : 'NO'}` },
      { Line: cpr.notes ? `Notes: ${cpr.notes}` : '' },
    ];
    const sosWs = XLSX.utils.json_to_sheet(sosRows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, headerWs, 'Header');
    XLSX.utils.book_append_sheet(wb, detailWs, 'Employees');
    XLSX.utils.book_append_sheet(wb, sosWs, 'Statement of Compliance');
    streamXlsx(res, wb, `CPR-${cpr.payrollNumber ?? 'X'}-week-${cpr.weekEnding ?? 'unknown'}.xlsx`);
  } catch (err) {
    next(err);
  }
});

