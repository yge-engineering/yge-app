// audit: CSV uploads log to request-id middleware; review with /admin/audit-log.
// Bid results routes — agency-posted bid tabulations.
//
// Posting a result with outcome=WON_BY_YGE auto-advances the linked
// job to AWARDED; outcome=WON_BY_OTHER advances to LOST. The side
// effect lives here (not in the pure data module) so it can read both
// stores in one transaction.

import { Router } from 'express';
import multer from 'multer';

const bidUpload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
import { prisma } from '@yge/db';
import {
  BidResultCreateSchema,
  BidResultPatchSchema,
} from '@yge/shared';
import {
  createBidResult,
  getBidResult,
  listBidResults,
  updateBidResult,
} from '../lib/bid-results-store';
import { getJob, updateJob } from '../lib/jobs-store';

export const bidResultsRouter = Router();

/** Side-effect: when a bid result lands with a YGE-decisive outcome,
 *  bump the job's pursuit status. We never demote AWARDED back to
 *  PURSUING — once a contract is signed, that's terminal in the
 *  pipeline. */
async function maybeAdvanceJobStatus(
  jobId: string,
  outcome: 'WON_BY_YGE' | 'WON_BY_OTHER' | 'NO_AWARD' | 'TBD',
): Promise<void> {
  if (outcome === 'TBD' || outcome === 'NO_AWARD') return;
  const job = await getJob(jobId);
  if (!job) return;
  if (outcome === 'WON_BY_YGE' && job.status !== 'AWARDED') {
    await updateJob(jobId, { status: 'AWARDED' });
  } else if (outcome === 'WON_BY_OTHER' && job.status !== 'LOST' && job.status !== 'AWARDED') {
    await updateJob(jobId, { status: 'LOST' });
  }
}

bidResultsRouter.post('/import-csv', bidUpload.single('file'), async (req, res, next) => {
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

    const iJobNumber = idx('jobNumber');
    const iBidOpenedAt = idx('bidOpenedAt');
    const iOutcome = idx('outcome');
    const iBidderName = idx('bidderName');
    const iBidderAmount = idx('bidderAmount');
    const iBidderIsYge = idx('bidderIsYge');
    const iBidderNotes = idx('bidderNotes');
    if (iJobNumber < 0 || iBidOpenedAt < 0 || iBidderName < 0 || iBidderAmount < 0) {
      return res.status(400).json({ error: 'CSV must have jobNumber, bidOpenedAt, bidderName, bidderAmount columns' });
    }

    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const jobByNumber = new Map(jobs.map((j) => [j.jobNumber, j]));

    // Group bidders by (jobNumber, bidOpenedAt).
    interface Group { jobNumber: string; bidOpenedAt: string; outcome: string; bidders: Array<{ name: string; amountCents: number; isYge: boolean; notes?: string }> }
    const groups = new Map<string, Group>();
    const errors: Array<{ row: number; reason: string }> = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const jobNumber = (row[iJobNumber] ?? '').trim();
      const bidOpenedAt = (row[iBidOpenedAt] ?? '').trim();
      const bidderName = (row[iBidderName] ?? '').trim();
      const amountStr = (row[iBidderAmount] ?? '').trim();
      const amount = Number(amountStr.replace(/[$,]/g, ''));
      if (!jobNumber || !bidOpenedAt || !bidderName || !Number.isFinite(amount)) {
        errors.push({ row: r + 1, reason: 'missing required cell' });
        continue;
      }
      const outcome = iOutcome >= 0 ? (row[iOutcome] ?? '').trim() || 'TBD' : 'TBD';
      const isYge = iBidderIsYge >= 0 ? (row[iBidderIsYge] ?? '').trim().toLowerCase() === 'true' : bidderName.toLowerCase().includes('young general');
      const k = jobNumber + '|' + bidOpenedAt;
      let g = groups.get(k);
      if (!g) {
        g = { jobNumber, bidOpenedAt, outcome, bidders: [] };
        groups.set(k, g);
      }
      g.bidders.push({
        name: bidderName,
        amountCents: Math.round(amount * 100),
        isYge,
        notes: iBidderNotes >= 0 ? (row[iBidderNotes] ?? '').trim() || undefined : undefined,
      });
    }

    const summary = {
      groups: groups.size,
      bidders: rows.length - 1,
      created: 0,
      updated: 0,
      skipped: 0,
      errors,
      dryRun,
    };

    if (dryRun) {
      return res.json({ summary });
    }

    for (const g of groups.values()) {
      const job = jobByNumber.get(g.jobNumber);
      if (!job) {
        summary.errors.push({ row: 0, reason: `Job # ${g.jobNumber} not found` });
        summary.skipped++;
        continue;
      }
      g.bidders.sort((a, b) => a.amountCents - b.amountCents);
      const data = {
        id: '',
        createdAt: '',
        updatedAt: '',
        jobId: job.id,
        bidOpenedAt: g.bidOpenedAt,
        outcome: g.outcome,
        bidders: g.bidders,
      };

      // Match existing result by jobId + bidOpenedAt.
      const all = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null } });
      const existing = all.find((r) => {
        const rd = r.data as { jobId?: string; bidOpenedAt?: string } | null;
        return rd?.jobId === job.id && rd?.bidOpenedAt === g.bidOpenedAt;
      });

      if (existing) {
        const merged = { ...((existing.data as object) ?? {}), ...data, id: existing.id, createdAt: existing.createdAt.toISOString(), updatedAt: new Date().toISOString() };
        await prisma.bidResult.update({
          where: { id: existing.id },
          data: { data: JSON.parse(JSON.stringify(merged)) },
        });
        summary.updated++;
      } else {
        const id = 'bid-result-' + Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
        const now = new Date().toISOString();
        await prisma.bidResult.create({
          data: {
            id,
            companyId,
            jobId: job.id,
            bidOpenedAt: g.bidOpenedAt,
            data: JSON.parse(JSON.stringify({ ...data, id, createdAt: now, updatedAt: now })),
          },
        });
        summary.created++;
      }
    }

    res.json({ summary });
  } catch (err) { next(err); }
});

bidResultsRouter.get('/export.csv', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const results = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    const lines: string[] = [];
    lines.push('jobNumber,jobName,agency,bidOpenedAt,awardedAt,outcome,bidderRank,bidderName,bidderAmount,bidderIsYge,bidderNotes');

    function esc(v: unknown): string {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    for (const r of results) {
      const d = r.data as {
        jobId?: string;
        bidOpenedAt?: string;
        awardedAt?: string;
        outcome?: string;
        bidders?: Array<{ name?: string; amountCents?: number; isYge?: boolean; notes?: string }>;
      } | null;
      const job = d?.jobId ? jobById.get(d.jobId) : undefined;
      const jd = (job?.data as { ownerAgency?: string; client?: string } | null) ?? null;
      const agency = jd?.ownerAgency ?? jd?.client ?? '';
      const bidders = (d?.bidders ?? []).slice().sort((a, b) => (a.amountCents ?? 0) - (b.amountCents ?? 0));
      if (bidders.length === 0) {
        lines.push([
          esc(job?.jobNumber), esc(job?.name), esc(agency),
          esc(d?.bidOpenedAt), esc(d?.awardedAt), esc(d?.outcome),
          '', '', '', '', '',
        ].join(','));
        continue;
      }
      bidders.forEach((b, rank) => {
        lines.push([
          esc(job?.jobNumber), esc(job?.name), esc(agency),
          esc(d?.bidOpenedAt), esc(d?.awardedAt), esc(d?.outcome),
          String(rank + 1), esc(b.name),
          esc(((b.amountCents ?? 0) / 100).toFixed(2)),
          b.isYge ? 'true' : 'false',
          esc(b.notes),
        ].join(','));
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bid-results.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

bidResultsRouter.get('/stats', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const results = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null } });

    interface YearStat { year: number; total: number; won: number; lost: number; tbd: number; noAward: number; wonCents: number }
    const yearMap = new Map<number, YearStat>();
    let lifetime: YearStat = { year: 0, total: 0, won: 0, lost: 0, tbd: 0, noAward: 0, wonCents: 0 };

    for (const r of results) {
      const d = r.data as { bidOpenedAt?: string; outcome?: string; bidders?: Array<{ isYge?: boolean; amountCents?: number }> } | null;
      const yr = d?.bidOpenedAt ? new Date(d.bidOpenedAt).getFullYear() : 0;
      let st = yearMap.get(yr);
      if (!st) {
        st = { year: yr, total: 0, won: 0, lost: 0, tbd: 0, noAward: 0, wonCents: 0 };
        yearMap.set(yr, st);
      }
      lifetime.total += 1;
      st.total += 1;
      switch (d?.outcome) {
        case 'WON_BY_YGE': {
          lifetime.won += 1;
          st.won += 1;
          const ygeBid = (d.bidders ?? []).find((b) => b.isYge);
          const cents = ygeBid?.amountCents ?? 0;
          lifetime.wonCents += cents;
          st.wonCents += cents;
          break;
        }
        case 'WON_BY_OTHER': lifetime.lost += 1; st.lost += 1; break;
        case 'NO_AWARD': lifetime.noAward += 1; st.noAward += 1; break;
        default: lifetime.tbd += 1; st.tbd += 1;
      }
    }

    const years = [...yearMap.values()].sort((a, b) => b.year - a.year);
    res.json({ lifetime, years });
  } catch (err) { next(err); }
});

bidResultsRouter.get('/by-agency', async (_req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    interface JobRow { id: string; ownerAgency: string }
    const jobs = await prisma.job.findMany({ where: { companyId, deletedAt: null } });
    const ownerByJobId = new Map<string, string>();
    for (const j of jobs) {
      const d = j.data as { ownerAgency?: string; client?: string } | null;
      const owner = d?.ownerAgency ?? d?.client ?? '—';
      ownerByJobId.set(j.id, owner);
    }

    const results = await prisma.bidResult.findMany({ where: { companyId, deletedAt: null } });

    interface AgencyStat {
      agency: string;
      total: number;
      won: number;
      lost: number;
      noAward: number;
      tbd: number;
    }
    const map = new Map<string, AgencyStat>();
    for (const r of results) {
      const d = r.data as { jobId?: string; outcome?: string } | null;
      const agency = (d?.jobId && ownerByJobId.get(d.jobId)) || '—';
      let st = map.get(agency);
      if (!st) {
        st = { agency, total: 0, won: 0, lost: 0, noAward: 0, tbd: 0 };
        map.set(agency, st);
      }
      st.total += 1;
      switch (d?.outcome) {
        case 'WON_BY_YGE': st.won += 1; break;
        case 'WON_BY_OTHER': st.lost += 1; break;
        case 'NO_AWARD': st.noAward += 1; break;
        default: st.tbd += 1;
      }
    }

    const rows = [...map.values()]
      .map((s) => ({
        ...s,
        winRate: s.total > 0 ? s.won / s.total : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ rows });
  } catch (err) { next(err); }
});

bidResultsRouter.get('/', async (req, res, next) => {
  try {
    const results = await listBidResults({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ results });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getBidResult(req.params.id);
    if (!r) return res.status(404).json({ error: 'Bid result not found' });
    return res.json({ result: r });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = BidResultCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createBidResult(parsed.data);
    await maybeAdvanceJobStatus(r.jobId, r.outcome);
    return res.status(201).json({ result: r });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = BidResultPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateBidResult(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Bid result not found' });
    await maybeAdvanceJobStatus(updated.jobId, updated.outcome);
    return res.json({ result: updated });
  } catch (err) {
    next(err);
  }
});
