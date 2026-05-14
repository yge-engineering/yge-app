// Vendor routes.

import { Router } from 'express';
import multer from 'multer';

const vendorUpload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
import { randomUUID } from 'crypto';
import { prisma } from '@yge/db';
import {
  VendorCreateSchema,
  VendorPatchSchema,
  maskTaxId,
  vendorCoiCurrent,
  vendorKindLabel,
  vendorPaymentTermsLabel,
  vendorW9Current,
  type Vendor,
} from '@yge/shared';
import {
  createVendor,
  getVendor,
  listVendors,
  updateVendor,
} from '../lib/vendors-store';
import { maybeCsv } from '../lib/csv-response';

export const vendorsRouter = Router();

const VENDOR_CSV_COLUMNS = [
  { header: 'Legal name', get: (v: Vendor) => v.legalName },
  { header: 'DBA', get: (v: Vendor) => v.dbaName ?? '' },
  { header: 'Kind', get: (v: Vendor) => vendorKindLabel(v.kind) },
  { header: 'Tax ID (masked)', get: (v: Vendor) => maskTaxId(v.taxId) },
  { header: '1099-NEC', get: (v: Vendor) => (v.is1099Reportable ? 'Yes' : 'No') },
  { header: 'W-9 current', get: (v: Vendor) => (vendorW9Current(v) ? 'Yes' : 'No') },
  { header: 'COI current', get: (v: Vendor) => (vendorCoiCurrent(v) ? 'Yes' : 'No') },
  { header: 'COI expires', get: (v: Vendor) => v.coiExpiresOn ?? '' },
  { header: 'Payment terms', get: (v: Vendor) => vendorPaymentTermsLabel(v.paymentTerms) },
  { header: 'On hold', get: (v: Vendor) => (v.onHold ? 'Yes' : 'No') },
  { header: 'CSLB #', get: (v: Vendor) => v.cslbLicense ?? '' },
  { header: 'DIR #', get: (v: Vendor) => v.dirRegistration ?? '' },
  { header: 'Phone', get: (v: Vendor) => v.phone ?? '' },
  { header: 'Email', get: (v: Vendor) => v.email ?? '' },
  { header: 'City', get: (v: Vendor) => v.city ?? '' },
  { header: 'State', get: (v: Vendor) => v.state ?? '' },
] as const;

vendorsRouter.get('/', async (req, res, next) => {
  try {
    const vendors = await listVendors({
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });
    if (maybeCsv(req, res, vendors, VENDOR_CSV_COLUMNS, 'vendors')) return;
    return res.json({ vendors });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const vendors = await prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } });

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const x = String(v);
      if (x.includes(',') || x.includes('"') || x.includes('\n')) return '"' + x.replace(/"/g, '""') + '"';
      return x;
    }

    const lines: string[] = [];
    lines.push('id,legalName,dbaName,kind,contactName,phone,email,tradeSpecialty,licenseNumber,paymentTerms,is1099Reportable,notes');
    for (const v of vendors) {
      const d = (v.data as Record<string, unknown> | null) ?? {};
      lines.push([
        esc(v.id),
        esc((d.legalName as string) ?? ''),
        esc((d.dbaName as string) ?? ''),
        esc((d.kind as string) ?? ''),
        esc((d.contactName as string) ?? ''),
        esc((d.phone as string) ?? ''),
        esc((d.email as string) ?? ''),
        esc((d.tradeSpecialty as string) ?? ''),
        esc((d.licenseNumber as string) ?? ''),
        esc((d.paymentTerms as string) ?? ''),
        esc(d.is1099Reportable ? 'true' : 'false'),
        esc((d.notes as string) ?? ''),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendors.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

vendorsRouter.post('/import-csv', vendorUpload.single('file'), async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dryRun = String(req.query.dryRun ?? '') === '1';

    function parseCsv(s: string): string[][] {
      const rows: string[][] = [];
      let row: string[] = [];
      let cell = '';
      let inQ = false;
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
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty' });
    const header = (rows[0] ?? []).map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);

    const iLegalName = idx('legalName');
    const iKind = idx('kind');
    if (iLegalName < 0 || iKind < 0) {
      return res.status(400).json({ error: 'CSV must have legalName + kind columns' });
    }
    const iDbaName = idx('dbaName');
    const iContactName = idx('contactName');
    const iPhone = idx('phone');
    const iEmail = idx('email');
    const iTrade = idx('tradeSpecialty');
    const iLicense = idx('licenseNumber');
    const iTerms = idx('paymentTerms');
    const i1099 = idx('is1099Reportable');
    const iNotes = idx('notes');

    const validKinds = new Set(['SUBCONTRACTOR', 'SUPPLIER', 'RENTAL', 'LABOR', 'SERVICE', 'OTHER']);
    const summary = {
      total: rows.length - 1,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; reason: string }>,
      dryRun,
    };

    const allVendors = await prisma.vendor.findMany({ where: { companyId, deletedAt: null } });

    function cell(row: string[], i: number): string | undefined {
      if (i < 0) return undefined;
      const v = (row[i] ?? '').trim();
      return v.length > 0 ? v : undefined;
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const legalName = (row[iLegalName] ?? '').trim();
      const kind = (row[iKind] ?? '').trim().toUpperCase();
      if (!legalName) {
        summary.errors.push({ row: r + 1, reason: 'legalName is empty' });
        summary.skipped++;
        continue;
      }
      if (!validKinds.has(kind)) {
        summary.errors.push({ row: r + 1, reason: `invalid kind "${kind}"` });
        summary.skipped++;
        continue;
      }
      const data = {
        legalName,
        dbaName: cell(row, iDbaName) ?? legalName,
        kind,
        contactName: cell(row, iContactName),
        phone: cell(row, iPhone),
        email: cell(row, iEmail),
        tradeSpecialty: cell(row, iTrade),
        licenseNumber: cell(row, iLicense),
        paymentTerms: cell(row, iTerms) ?? 'NET_30',
        is1099Reportable: cell(row, i1099)?.toLowerCase() !== 'false',
        notes: cell(row, iNotes),
      };
      const match = allVendors.find((v) => {
        const vd = v.data as { legalName?: string } | null;
        return (vd?.legalName ?? '').toLowerCase() === legalName.toLowerCase();
      });

      if (dryRun) {
        if (match) summary.updated++;
        else summary.created++;
        continue;
      }

      if (match) {
        const merged = { ...((match.data as object) ?? {}), ...data };
        await prisma.vendor.update({
          where: { id: match.id },
          data: { data: JSON.parse(JSON.stringify(merged)) },
        });
        summary.updated++;
      } else {
        const id = 'vnd-' + randomUUID().replace(/-/g, '').slice(0, 12);
        await prisma.vendor.create({
          data: { id, companyId, data: JSON.parse(JSON.stringify(data)) },
        });
        summary.created++;
      }
    }

    res.json({ summary });
  } catch (err) { next(err); }
});

vendorsRouter.get('/scorecard', async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const kindFilter = typeof req.query.kind === 'string' ? req.query.kind : 'SUBCONTRACTOR';

    const vendors = await prisma.vendor.findMany({ where: { companyId, deletedAt: null } });
    const myVendors = vendors.filter((v) => {
      const d = v.data as { kind?: string; legalName?: string; dbaName?: string } | null;
      return d?.kind === kindFilter;
    });

    const invoices = await prisma.apInvoice.findMany({ where: { companyId, deletedAt: null } });

    interface ScoreRow {
      id: string;
      legalName: string;
      dbaName: string | null;
      jobsAwarded: Set<string>;
      totalPaidCents: number;
      totalUnpaidCents: number;
      daysToPay: number[];
      lastInvoiceAt: string | null;
    }
    const map = new Map<string, ScoreRow>();
    for (const v of myVendors) {
      const d = v.data as { legalName?: string; dbaName?: string } | null;
      map.set(v.id, {
        id: v.id,
        legalName: d?.legalName ?? v.id,
        dbaName: d?.dbaName ?? null,
        jobsAwarded: new Set<string>(),
        totalPaidCents: 0,
        totalUnpaidCents: 0,
        daysToPay: [],
        lastInvoiceAt: null,
      });
    }

    for (const inv of invoices) {
      if (!inv.vendorId || !map.has(inv.vendorId)) continue;
      const r = map.get(inv.vendorId)!;
      const d = inv.data as {
        jobId?: string;
        amountCents?: number;
        issuedAt?: string;
        paidAt?: string;
      } | null;
      if (d?.jobId) r.jobsAwarded.add(d.jobId);
      const cents = d?.amountCents ?? 0;
      if (inv.status === 'PAID' || d?.paidAt) {
        r.totalPaidCents += cents;
        if (d?.issuedAt && d.paidAt) {
          const issued = new Date(d.issuedAt).getTime();
          const paid = new Date(d.paidAt).getTime();
          if (Number.isFinite(issued) && Number.isFinite(paid) && paid > issued) {
            r.daysToPay.push((paid - issued) / 86400000);
          }
        }
      } else {
        r.totalUnpaidCents += cents;
      }
      const issuedAt = d?.issuedAt ?? null;
      if (issuedAt && (r.lastInvoiceAt === null || issuedAt > r.lastInvoiceAt)) {
        r.lastInvoiceAt = issuedAt;
      }
    }

    const rows = [...map.values()].map((r) => ({
      id: r.id,
      legalName: r.legalName,
      dbaName: r.dbaName,
      jobsAwarded: r.jobsAwarded.size,
      totalPaidCents: r.totalPaidCents,
      totalUnpaidCents: r.totalUnpaidCents,
      avgDaysToPay: r.daysToPay.length > 0
        ? r.daysToPay.reduce((a, b) => a + b, 0) / r.daysToPay.length
        : null,
      lastInvoiceAt: r.lastInvoiceAt,
    }));
    rows.sort((a, b) => b.totalPaidCents - a.totalPaidCents);

    res.json({ rows });
  } catch (err) { next(err); }
});

vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    const v = await getVendor(req.params.id);
    if (!v) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = VendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const v = await createVendor(parsed.data);
    return res.status(201).json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = VendorPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateVendor(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: updated });
  } catch (err) {
    next(err);
  }
});
