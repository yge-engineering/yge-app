// Daily reports CSV bulk import — appends lines to (jobNumber, date)
// DailyReport rows; creates the report if missing.

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@yge/db';
import { randomUUID } from 'crypto';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

export const importedDailyReportsImportRouter = Router();

importedDailyReportsImportRouter.post('/csv', upload.single('file'), async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? '') === '1';

    function parseCsv(s: string): string[][] {
      const rows: string[][] = [];
      let row: string[] = []; let cell = ''; let inQ = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inQ) {
          if (c === '"' && s[i + 1] === '"') { cell += '"'; i += 1; }
          else if (c === '"') { inQ = false; }
          else { cell += c; }
        } else {
          if (c === '"') { inQ = true; }
          else if (c === ',') { row.push(cell); cell = ''; }
          else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i += 1;
            row.push(cell); cell = '';
            if (row.some((x) => x.length > 0)) rows.push(row);
            row = [];
          } else { cell += c; }
        }
      }
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        if (row.some((x) => x.length > 0)) rows.push(row);
      }
      return rows;
    }

    const rows = parseCsv(req.file.buffer.toString('utf8'));
    if (rows.length === 0) return res.status(400).json({ error: 'CSV empty' });

    const header = (rows[0] ?? []).map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);
    const iDate = idx('date');
    const iJobNumber = idx('jobNumber');
    const iCategory = idx('category');
    const iCostCode = idx('costCode');
    const iDesc = idx('description');
    const iQty = idx('qtyHrs');
    const iUnit = idx('unit');
    const iRate = idx('rate');
    const iTotal = idx('totalCost');
    const iWho = idx('employeeVendor');
    const iNotes = idx('notes');

    if (iDate < 0 || iJobNumber < 0) {
      return res.status(400).json({ error: 'CSV must have date + jobNumber columns' });
    }

    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const jobByNumber = new Map(jobs.map((j) => [j.jobNumber, j]));

    interface Line {
      date: string;
      jobNumber: string;
      category: string | null;
      costCode: string | null;
      description: string | null;
      qtyHrs: number | null;
      unit: string | null;
      rateCents: number | null;
      totalCostCents: number | null;
      employeeVendor: string | null;
      notes: string | null;
    }

    const grouped = new Map<string, Line[]>();
    const errors: Array<{ row: number; reason: string }> = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const date = (row[iDate] ?? '').trim();
      const jobNumber = (row[iJobNumber] ?? '').trim();
      if (!date || !jobNumber) {
        errors.push({ row: r + 1, reason: 'missing date or jobNumber' });
        continue;
      }
      const line: Line = {
        date,
        jobNumber,
        category: iCategory >= 0 ? (row[iCategory] ?? '').trim() || null : null,
        costCode: iCostCode >= 0 ? (row[iCostCode] ?? '').trim() || null : null,
        description: iDesc >= 0 ? (row[iDesc] ?? '').trim() || null : null,
        qtyHrs: iQty >= 0 ? Number((row[iQty] ?? '0').trim()) || null : null,
        unit: iUnit >= 0 ? (row[iUnit] ?? '').trim() || null : null,
        rateCents: iRate >= 0 ? Math.round(Number((row[iRate] ?? '0').replace(/[$,]/g, '')) * 100) || null : null,
        totalCostCents: iTotal >= 0 ? Math.round(Number((row[iTotal] ?? '0').replace(/[$,]/g, '')) * 100) || null : null,
        employeeVendor: iWho >= 0 ? (row[iWho] ?? '').trim() || null : null,
        notes: iNotes >= 0 ? (row[iNotes] ?? '').trim() || null : null,
      };
      const k = `${jobNumber}|${date}`;
      const arr = grouped.get(k) ?? [];
      arr.push(line);
      grouped.set(k, arr);
    }

    const summary = {
      total: rows.length - 1,
      reports: grouped.size,
      created: 0,
      updated: 0,
      skipped: 0,
      errors,
      dryRun,
    };

    if (dryRun) return res.json({ summary });

    for (const [key, lines] of grouped) {
      const [jobNumber, date] = key.split('|') as [string, string];
      const job = jobByNumber.get(jobNumber);
      if (!job) {
        summary.errors.push({ row: 0, reason: `Job # ${jobNumber} not found` });
        summary.skipped += lines.length;
        continue;
      }
      const existing = await prisma.dailyReport.findFirst({
        where: { companyId, jobId: job.id, reportDate: date, deletedAt: null },
      });
      if (existing) {
        const d = (existing.data as { lines?: unknown[] } | null) ?? {};
        const existingLines = Array.isArray(d.lines) ? d.lines : [];
        await prisma.dailyReport.update({
          where: { id: existing.id },
          data: { data: JSON.parse(JSON.stringify({ ...d, lines: [...existingLines, ...lines], importedFromExcel: true })) },
        });
        summary.updated += 1;
      } else {
        const id = 'dr-' + randomUUID().replace(/-/g, '').slice(0, 12);
        await prisma.dailyReport.create({
          data: {
            id, companyId, jobId: job.id, reportDate: date,
            data: JSON.parse(JSON.stringify({ lines, importedFromExcel: true })),
          },
        });
        summary.created += 1;
      }
    }

    res.json({ summary });
  } catch (err) { next(err); }
});
