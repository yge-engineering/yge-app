// Unit tests for the file-backed drafts store.
//
// Each test gets a fresh tmpdir via DRAFTS_DATA_DIR. The store reads the env
// lazily on every call, so we can flip it without touching the module cache.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveDraft, listDrafts, getDraft } from './drafts-store';

const sampleDraft = {
  projectName: 'Test Project Drainage',
  projectType: 'DRAINAGE' as const,
  ownerAgency: 'Tehama County',
  location: 'Cottonwood, CA',
  bidDueDate: '2026-05-30',
  bidItems: [
    {
      itemNumber: '1',
      description: 'Mobilization',
      unit: 'LS',
      quantity: 1,
      confidence: 'HIGH' as const,
    },
  ],
  assumptions: [],
  questionsForEstimator: [],
  overallConfidence: 'HIGH' as const,
};

const sampleInput = {
  jobId: 'cabc1234567890abcdefghijk',
  modelUsed: 'claude-sonnet-4-6',
  promptVersion: 'plans-to-estimate@1.0.0',
  usage: { inputTokens: 1234, outputTokens: 567 },
  durationMs: 41200,
  documentText: 'A test RFP document body, long enough to be realistic.',
  draft: sampleDraft,
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yge-drafts-test-'));
  process.env.DRAFTS_DATA_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.DRAFTS_DATA_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('drafts-store', () => {
  it('saves a draft to disk and lists it', async () => {
    const saved = await saveDraft(sampleInput);

    expect(saved.id).toMatch(/^\d{4}-\d{2}-\d{2}-test-project-drainage-[a-f0-9]{8}$/);
    expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.draft.projectName).toBe('Test Project Drainage');

    const list = await listDrafts();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(saved.id);
    expect(list[0].projectName).toBe('Test Project Drainage');
    expect(list[0].bidItemCount).toBe(1);
    expect(list[0].overallConfidence).toBe('HIGH');
  });

  it('reads a saved draft back via getDraft', async () => {
    const saved = await saveDraft(sampleInput);
    const fetched = await getDraft(saved.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(saved.id);
    expect(fetched!.draft.projectName).toBe('Test Project Drainage');
    expect(fetched!.documentText).toBe(sampleInput.documentText);
    expect(fetched!.usage).toEqual({ inputTokens: 1234, outputTokens: 567 });
  });

  it('returns null for an unknown id', async () => {
    expect(await getDraft('2026-04-24-nope-deadbeef')).toBeNull();
  });

  it('rejects path-traversal attempts', async () => {
    expect(await getDraft('../../etc/passwd')).toBeNull();
    expect(await getDraft('a/b')).toBeNull();
    expect(await getDraft('')).toBeNull();
  });

  it('keeps newest first when listing multiple drafts', async () => {
    const first = await saveDraft({
      ...sampleInput,
      draft: { ...sampleDraft, projectName: 'First Project' },
    });
    // tiny gap so timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    const second = await saveDraft({
      ...sampleInput,
      draft: { ...sampleDraft, projectName: 'Second Project' },
    });

    const list = await listDrafts();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
  });

  it('returns empty list when no drafts have been saved yet', async () => {
    const list = await listDrafts();
    expect(list).toEqual([]);
  });
});
