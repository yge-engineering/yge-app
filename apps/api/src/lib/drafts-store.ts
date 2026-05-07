// Postgres-backed store for Plans-to-Estimate drafts (PtoEDraft model).
//
// Each successful AI run lands as one row. JSON `data` column holds
// the SavedDraft shape. Listing returns lightweight summaries built
// from the JSON without unpacking every field.

import { randomBytes } from 'node:crypto';
import { prisma } from '@yge/db';
import type { PtoEOutput } from '@yge/shared';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

export interface SavedDraft {
  id: string;
  createdAt: string;
  jobId: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function makeId(projectName: string, when: Date): string {
  const date = when.toISOString().slice(0, 10);
  const slug = slugify(projectName) || 'draft';
  const rand = randomBytes(4).toString('hex');
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

export async function saveDraft(input: NewDraftInput): Promise<SavedDraft> {
  const now = new Date();
  const id = makeId(input.draft.projectName, now);
  const saved: SavedDraft = {
    id,
    createdAt: now.toISOString(),
    ...input,
  };
  await prisma.ptoEDraft.create({
    data: {
      id,
      companyId: DEFAULT_COMPANY_ID,
      jobId: input.jobId,
      data: saved as unknown as object,
    },
  });
  return saved;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  const rows = await prisma.ptoEDraft.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => summarize(r.data as unknown as SavedDraft));
}

export async function getDraft(id: string): Promise<SavedDraft | null> {
  // Defensive id shape — same regex as the file-store had.
  if (!/^[a-z0-9-]{10,80}$/.test(id)) return null;
  const row = await prisma.ptoEDraft.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? (row.data as unknown as SavedDraft) : null;
}
