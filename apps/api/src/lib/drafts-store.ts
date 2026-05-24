// Postgres-backed store for Plans-to-Estimate drafts (PtoEDraft model).
//
// Each successful AI run lands as one row. JSON `data` column holds
// the SavedDraft shape. Listing returns lightweight summaries built
// from the JSON without unpacking every field.

import { randomBytes } from 'node:crypto';
import { getRequestCompanyId } from './request-context';
import { prisma } from '@yge/db';
import type { PtoEOutput } from '@yge/shared';
import { sumPtoEBidTotalCents } from '@yge/shared';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

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
  /** Sum of estimatedLineTotalCents across the draft's bid items. Undefined
   *  for older drafts (pre-1.1.0) or T&M-only jobs that never carried
   *  prices. Always recomputed from the items so the value stays correct
   *  even if the persisted JSON predates the new field. */
  estimatedBidTotalCents?: number;
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
  // Always recompute from items so the value stays correct even when the
  // persisted JSON predates the field (older drafts may not have stored
  // estimatedBidTotalCents themselves). Returns 0 for fully unpriced
  // drafts — we surface that as `undefined` so the UI can show "—".
  const grand = sumPtoEBidTotalCents(d.draft.bidItems);
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
    estimatedBidTotalCents: grand > 0 ? grand : undefined,
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
      companyId: companyId(),
      jobId: input.jobId,
      data: saved as unknown as object,
    },
  });
  return saved;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  const rows = await prisma.ptoEDraft.findMany({
    where: { companyId: companyId(), deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => summarize(r.data as unknown as SavedDraft));
}

export async function getDraft(id: string): Promise<SavedDraft | null> {
  // Defensive id shape — same regex as the file-store had.
  if (!/^[a-z0-9-]{10,80}$/.test(id)) return null;
  const row = await prisma.ptoEDraft.findFirst({
    where: { id, companyId: companyId(), deletedAt: null },
  });
  return row ? (row.data as unknown as SavedDraft) : null;
}
