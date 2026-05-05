// Plans-to-Estimate feedback store.
//
// Plain English: the AI drafts plans-to-estimate output; the human
// estimator either accepts it as-is, edits it, or scraps it. This
// store records the human verdict so future prompt iterations and
// fine-tuning passes can correlate AI accuracy with prompt versions.
//
// File-backed JSON at data/p2e-feedback/log.jsonl — one JSON entry
// per line, append-only. The Phase 5 Postgres migration moves this
// to a real table.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface FeedbackEntry {
  id: string;
  loggedAt: string;
  /** Estimator's portal email (or empty if not signed in). */
  byEmail?: string;
  /** Linked draft id from the original AI run. */
  draftId?: string;
  /** Linked priced estimate id (when a draft was promoted). */
  estimateId?: string;
  /** Quick verdict. */
  kind: 'good' | 'bad' | 'mixed';
  /** Free-form reviewer note. */
  notes?: string;
  /** AI prompt version on the original draft, for cohort analysis. */
  promptVersion?: string;
}

function dataDir(): string {
  return (
    process.env.P2E_FEEDBACK_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'p2e-feedback')
  );
}
function logPath(): string {
  return path.join(dataDir(), 'log.jsonl');
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
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.appendFile(logPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

export async function listFeedback(): Promise<FeedbackEntry[]> {
  try {
    const raw = await fs.readFile(logPath(), 'utf8');
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as FeedbackEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is FeedbackEntry => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
