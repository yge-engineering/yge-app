// Postgres-backed store for Plans-to-Estimate feedback.
// Append-only log: every entry records the human's verdict on an
// AI draft so prompt iterations can be cohort-analyzed.

import { prisma } from '@yge/db';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

interface FeedbackEntry {
  id: string;
  loggedAt: string;
  byEmail?: string;
  draftId?: string;
  estimateId?: string;
  kind: 'good' | 'bad' | 'mixed';
  notes?: string;
  promptVersion?: string;
}

function newId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `p2efb-${hex.padStart(8, '0')}`;
}

export interface AppendInput {
  byEmail?: string;
  draftId?: string;
  estimateId?: string;
  kind: 'good' | 'bad' | 'mixed';
  notes?: string;
  promptVersion?: string;
}

export async function appendFeedback(
  input: AppendInput,
): Promise<FeedbackEntry> {
  const entry: FeedbackEntry = {
    id: newId(),
    loggedAt: new Date().toISOString(),
    kind: input.kind,
    ...(input.byEmail ? { byEmail: input.byEmail } : {}),
    ...(input.draftId ? { draftId: input.draftId } : {}),
    ...(input.estimateId ? { estimateId: input.estimateId } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
  };
  await prisma.ptoEFeedback.create({
    data: {
      id: entry.id,
      companyId: DEFAULT_COMPANY_ID,
      draftId: entry.draftId ?? null,
      data: entry as unknown as object,
    },
  });
  return entry;
}

export async function listFeedback(): Promise<FeedbackEntry[]> {
  const rows = await prisma.ptoEFeedback.findMany({
    where: { companyId: DEFAULT_COMPANY_ID },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.data as unknown as FeedbackEntry);
}
