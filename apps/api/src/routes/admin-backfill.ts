// Admin: one-shot backfill of file-store JSON into Postgres.
//
// Plain English: Phase 2 cut every store from JSON-on-disk to
// Postgres. Anything in /var/data/* that pre-dates the cutover is
// invisible until we copy it into the DB. This endpoint walks the
// file dirs and upserts each row by id. Safe to re-run; rows that
// already exist in Postgres are left alone.

import { Router } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { prisma } from '@yge/db';
import {
  JobSchema,
  CustomerSchema,
  EmployeeSchema,
  PricedEstimateSchema,
  BidTabSchema,
  type CustomerKind,
  type EmploymentStatus,
  type JobStatus,
} from '@yge/shared';
import { logger } from '../lib/logger';

export const adminBackfillRouter = Router();

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

interface BackfillCounts {
  read: number;
  inserted: number;
  skipped: number;
  errors: Array<{ id: string; reason: string }>;
}

function emptyCounts(): BackfillCounts {
  return { read: 0, inserted: 0, skipped: 0, errors: [] };
}

function dataDirFor(envKey: string, fallback: string): string {
  const root = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
  return process.env[envKey] ?? path.join(root, fallback);
}

async function readJsonRowsFromIndex<T>(
  dir: string,
  parser: (raw: unknown) => T | null,
): Promise<T[]> {
  const indexPath = path.join(dir, 'index.json');
  let raw: string;
  try {
    raw = await fs.readFile(indexPath, 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: T[] = [];
  for (const entry of parsed) {
    const r = parser(entry);
    if (r) out.push(r);
  }
  return out;
}

// ---- Entity-by-entity helpers ------------------------------------------

async function backfillJobs(): Promise<BackfillCounts> {
  const c = emptyCounts();
  const dir = dataDirFor('JOBS_DATA_DIR', 'jobs');
  const jobs = await readJsonRowsFromIndex(dir, (r) => {
    const p = JobSchema.safeParse(r);
    return p.success ? p.data : null;
  });
  c.read = jobs.length;

  const statusMap: Record<JobStatus, 'BIDDING' | 'AWARDED' | 'LOST' | 'CLOSED'> = {
    PROSPECT: 'BIDDING',
    PURSUING: 'BIDDING',
    BID_SUBMITTED: 'BIDDING',
    AWARDED: 'AWARDED',
    LOST: 'LOST',
    NO_BID: 'LOST',
    ARCHIVED: 'CLOSED',
  };

  for (const job of jobs) {
    try {
      const idMatch = job.id.match(/-([a-f0-9]{8})$/);
      const jobNumber = idMatch ? idMatch[1]! : job.id.slice(-8);
      // Upsert: if the row already exists in Postgres, leave it; if
      // not, insert. Using upsert with an empty update keeps the
      // existing row's data alone.
      const existing = await prisma.job.findUnique({ where: { id: job.id } });
      if (existing) {
        c.skipped += 1;
        continue;
      }
      await prisma.job.create({
        data: {
          id: job.id,
          companyId: DEFAULT_COMPANY_ID,
          customerId: null,
          jobNumber,
          name: job.projectName,
          status: statusMap[job.status] ?? 'BIDDING',
          data: job as unknown as object,
        },
      });
      c.inserted += 1;
    } catch (err) {
      c.errors.push({ id: job.id, reason: (err as Error).message });
    }
  }
  return c;
}

async function backfillCustomers(): Promise<BackfillCounts> {
  const c = emptyCounts();
  const dir = dataDirFor('CUSTOMERS_DATA_DIR', 'customers');
  const customers = await readJsonRowsFromIndex(dir, (r) => {
    const p = CustomerSchema.safeParse(r);
    return p.success ? p.data : null;
  });
  c.read = customers.length;

  function kindToType(kind: CustomerKind): 'PUBLIC_AGENCY' | 'PRIVATE' | 'OTHER' {
    switch (kind) {
      case 'STATE_AGENCY':
      case 'FEDERAL_AGENCY':
      case 'COUNTY':
      case 'CITY':
      case 'SPECIAL_DISTRICT':
        return 'PUBLIC_AGENCY';
      case 'PRIVATE_OWNER':
      case 'PRIME_CONTRACTOR':
        return 'PRIVATE';
      default:
        return 'OTHER';
    }
  }

  for (const cus of customers) {
    try {
      const existing = await prisma.customer.findUnique({ where: { id: cus.id } });
      if (existing) {
        c.skipped += 1;
        continue;
      }
      await prisma.customer.create({
        data: {
          id: cus.id,
          companyId: DEFAULT_COMPANY_ID,
          name: cus.legalName,
          type: kindToType(cus.kind),
          contactName: cus.contactName ?? null,
          contactEmail: cus.email ?? null,
          contactPhone: cus.phone ?? null,
          addressLine: cus.billingAddressLine ?? null,
          city: cus.city ?? null,
          state: cus.state ?? null,
          zip: cus.zip ?? null,
          data: cus as unknown as object,
        },
      });
      c.inserted += 1;
    } catch (err) {
      c.errors.push({ id: cus.id, reason: (err as Error).message });
    }
  }
  return c;
}

async function backfillEmployees(): Promise<BackfillCounts> {
  const c = emptyCounts();
  const dir = dataDirFor('EMPLOYEES_DATA_DIR', 'employees');
  const rows = await readJsonRowsFromIndex(dir, (r) => {
    const p = EmployeeSchema.safeParse(r);
    return p.success ? p.data : null;
  });
  c.read = rows.length;

  function statusToDb(s: EmploymentStatus): 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' {
    if (s === 'LAID_OFF') return 'TERMINATED';
    return s as 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  }

  for (const e of rows) {
    try {
      const existing = await prisma.employee.findUnique({ where: { id: e.id } });
      if (existing) {
        c.skipped += 1;
        continue;
      }
      const hireDate = e.hiredOn ? new Date(e.hiredOn) : new Date(e.createdAt);
      await prisma.employee.create({
        data: {
          id: e.id,
          companyId: DEFAULT_COMPANY_ID,
          firstName: e.firstName,
          lastName: e.lastName,
          hireDate,
          status: statusToDb(e.status),
          classification: e.classification,
          data: e as unknown as object,
        },
      });
      c.inserted += 1;
    } catch (err) {
      c.errors.push({ id: e.id, reason: (err as Error).message });
    }
  }
  return c;
}

async function backfillEstimates(): Promise<BackfillCounts> {
  const c = emptyCounts();
  const dir = dataDirFor('ESTIMATES_DATA_DIR', 'estimates');
  // Estimates use one file per row; the index.json holds summaries.
  // Walk the directory and parse each *.json that isn't index.json.
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter(
      (f) => f.endsWith('.json') && f !== 'index.json',
    );
  } catch {
    return c;
  }
  for (const f of files) {
    let est;
    try {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const parsed = PricedEstimateSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) continue;
      est = parsed.data;
    } catch {
      continue;
    }
    c.read += 1;
    try {
      const existing = await prisma.estimate.findUnique({ where: { id: est.id } });
      if (existing) {
        c.skipped += 1;
        continue;
      }
      await prisma.estimate.create({
        data: {
          id: est.id,
          companyId: DEFAULT_COMPANY_ID,
          jobId: est.jobId,
          revision: 1,
          status: 'DRAFT',
          notes: est.notes ?? null,
          data: est as unknown as object,
        },
      });
      c.inserted += 1;
    } catch (err) {
      c.errors.push({ id: est.id, reason: (err as Error).message });
    }
  }
  return c;
}

async function backfillBidTabs(): Promise<BackfillCounts> {
  const c = emptyCounts();
  const dir = dataDirFor('BID_TABS_DATA_DIR', 'bid-tabs');
  const tabs = await readJsonRowsFromIndex(dir, (r) => {
    const p = BidTabSchema.safeParse(r);
    return p.success ? p.data : null;
  });
  c.read = tabs.length;
  for (const tab of tabs) {
    try {
      const existing = await prisma.bidTab.findUnique({ where: { id: tab.id } });
      if (existing) {
        c.skipped += 1;
        continue;
      }
      await prisma.bidTab.create({
        data: {
          id: tab.id,
          companyId: DEFAULT_COMPANY_ID,
          jobId: tab.ygeJobId ?? null,
          data: tab as unknown as object,
        },
      });
      c.inserted += 1;
    } catch (err) {
      c.errors.push({ id: tab.id, reason: (err as Error).message });
    }
  }
  return c;
}

// ---- Endpoint -----------------------------------------------------------

adminBackfillRouter.post('/backfill-from-disk', async (_req, res, next) => {
  try {
    logger.info('Starting file-store → Postgres backfill');
    const [jobs, customers, employees, estimates, bidTabs] = await Promise.all([
      backfillJobs(),
      backfillCustomers(),
      backfillEmployees(),
      backfillEstimates(),
      backfillBidTabs(),
    ]);
    logger.info(
      { jobs, customers, employees, estimates, bidTabs },
      'Backfill complete',
    );
    return res.json({ jobs, customers, employees, estimates, bidTabs });
  } catch (err) {
    next(err);
  }
});
