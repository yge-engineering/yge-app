// File-based store for daily reports.
//
// Phase 1 stand-in for the future Postgres `DailyReport` table. The id
// scheme `dr-YYYY-MM-DD-<8hex>` puts the date in the filename so a
// straight ls of the data directory sorts chronologically — useful when
// debugging data without the index.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DailyReportSchema,
  newDailyReportId,
  type DailyReport,
  type DailyReportCreate,
  type DailyReportPatch,
} from '@yge/shared';

function dataDir(): string {
  return (
    process.env.DAILY_REPORTS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'daily-reports')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function reportPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<DailyReport[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = DailyReportSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((d): d is DailyReport => d !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: DailyReport[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createDailyReport(input: DailyReportCreate): Promise<DailyReport> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newDailyReportId(input.date);
  const r: DailyReport = {
    id,
    createdAt: now,
    updatedAt: now,
    crewOnSite: input.crewOnSite ?? [],
    photoCount: input.photoCount ?? 0,
    submitted: input.submitted ?? false,
    ...input,
  };
  DailyReportSchema.parse(r);
  await fs.writeFile(reportPath(id), JSON.stringify(r, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(r);
  await writeIndex(index);
  return r;
}

export async function listDailyReports(filter?: {
  jobId?: string;
  foremanId?: string;
}): Promise<DailyReport[]> {
  let all = await readIndex();
  if (filter?.jobId) {
    all = all.filter((r) => r.jobId === filter.jobId);
  }
  if (filter?.foremanId) {
    all = all.filter((r) => r.foremanId === filter.foremanId);
  }
  // Sort by report date (newest first), then by createdAt as tiebreaker.
  all.sort((a, b) => {
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return all;
}

export async function getDailyReport(id: string): Promise<DailyReport | null> {
  if (!/^dr-\d{4}-\d{2}-\d{2}-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(reportPath(id), 'utf8');
    return DailyReportSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateDailyReport(
  id: string,
  patch: DailyReportPatch,
): Promise<DailyReport | null> {
  const existing = await getDailyReport(id);
  if (!existing) return null;
  const updated: DailyReport = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  DailyReportSchema.parse(updated);
  await fs.writeFile(reportPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((r) => r.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
