// File-based store for Plans-to-Estimate drafts.
//
// Phase 1 ships before Postgres lands, but we still need history so estimators
// can re-open a draft instead of paying Anthropic to redraft the same RFP.
// Each successful AI run writes a single JSON file to `apps/api/data/drafts/`
// keyed by a human-readable id (date + slug + random suffix). A small
// `index.json` keeps a sorted summary so list-views don't read every file.
//
// When Phase 1 swaps to Postgres, this module's surface area (saveDraft,
// listDrafts, getDraft) maps 1:1 to a Prisma repository — the route + UI
// stay unchanged.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { PtoEOutput } from '@yge/shared';

// Resolve the data dir lazily on every call so tests can override it via
// DRAFTS_DATA_DIR after the module has loaded.
function dataDir(): string {
  return (
    process.env.DRAFTS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'drafts')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}

export interface SavedDraft {
  id: string;
  createdAt: string;
  jobId: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  /** Original document text — kept so we can re-run through a future prompt
   *  version without making the user paste it again. */
  documentText: string;
  sessionNotes?: string;
  draft: PtoEOutput;
}

export interface DraftSummary {
  id: string;
  createdAt: string;
  jobId: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bidItemCount: number;
  modelUsed: string;
  promptVersion: string;
}

export interface NewDraftInput {
  jobId: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  documentText: string;
  sessionNotes?: string;
  draft: PtoEOutput;
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function makeId(projectName: string, when: Date): string {
  const date = when.toISOString().slice(0, 10); // 2026-04-24
  const slug = slugify(projectName) || 'draft';
  const rand = randomBytes(4).toString('hex'); // 8 hex chars
  return `${date}-${slug}-${rand}`;
}

function summarize(d: SavedDraft): DraftSummary {
  return {
    id: d.id,
    createdAt: d.createdAt,
    jobId: d.jobId,
    projectName: d.draft.projectName,
    projectType: d.draft.projectType,
    ownerAgency: d.draft.ownerAgency,
    location: d.draft.location,
    bidDueDate: d.draft.bidDueDate,
    overallConfidence: d.draft.overallConfidence,
    bidItemCount: d.draft.bidItems.length,
    modelUsed: d.modelUsed,
    promptVersion: d.promptVersion,
  };
}

async function readIndex(): Promise<DraftSummary[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DraftSummary[]) : [];
  } catch (err) {
    // First run — no index yet.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: DraftSummary[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function saveDraft(input: NewDraftInput): Promise<SavedDraft> {
  await ensureDir();
  const now = new Date();
  const id = makeId(input.draft.projectName, now);
  const saved: SavedDraft = {
    id,
    createdAt: now.toISOString(),
    ...input,
  };
  await fs.writeFile(
    path.join(DATA_DIR, `${id}.json`),
    JSON.stringify(saved, null, 2),
    'utf8',
  );
  const index = await readIndex();
  index.unshift(summarize(saved));
  await writeIndex(index);
  return saved;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  return readIndex();
}

export async function getDraft(id: string): Promise<SavedDraft | null> {
  // Defensive: only allow ids that match our format. Stops path traversal cold.
  if (!/^[a-z0-9-]{10,80}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), 'utf8');
    return JSON.parse(raw) as SavedDraft;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
