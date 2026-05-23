import { describe, it, expect } from 'vitest';
import {
  buildHashChain,
  isShapeValid,
  verifyPhotoHashChain,
  type PhotoChainEntryInput,
} from './photo-hash-chain';

// Deterministic test SHA-256 (Node crypto).
async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function input(over: Partial<PhotoChainEntryInput> = {}): PhotoChainEntryInput {
  return {
    photoId: 'photo-1',
    contentSha256: 'a'.repeat(64),
    capturedAt: '2026-05-22T15:00:00Z',
    jobId: 'job-1',
    uploaderId: 'emp-1',
    ...over,
  };
}

describe('buildHashChain', () => {
  it('first entry uses GENESIS prev pointer', async () => {
    const chain = await buildHashChain([input()], sha256Hex);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.prevEntryHash).toBe('GENESIS');
    expect(chain[0]!.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chains each entry to the previous entry hash', async () => {
    const a = input({ photoId: 'a', contentSha256: '1'.repeat(64) });
    const b = input({ photoId: 'b', contentSha256: '2'.repeat(64) });
    const chain = await buildHashChain([a, b], sha256Hex);
    expect(chain[1]!.prevEntryHash).toBe(chain[0]!.entryHash);
  });

  it('is deterministic — same input twice produces same chain', async () => {
    const a = input({ photoId: 'a' });
    const c1 = await buildHashChain([a], sha256Hex);
    const c2 = await buildHashChain([a], sha256Hex);
    expect(c1[0]!.entryHash).toBe(c2[0]!.entryHash);
  });

  it('changes when the captured timestamp changes', async () => {
    const a = await buildHashChain([input({ capturedAt: '2026-05-22T15:00:00Z' })], sha256Hex);
    const b = await buildHashChain([input({ capturedAt: '2026-05-22T15:00:01Z' })], sha256Hex);
    expect(a[0]!.entryHash).not.toBe(b[0]!.entryHash);
  });

  it('rejects malformed inputs at the boundary', async () => {
    await expect(
      buildHashChain(
        [input({ contentSha256: 'too-short' })],
        sha256Hex,
      ),
    ).rejects.toThrow();
    await expect(
      buildHashChain(
        [input({ capturedAt: '2026-05-22 15:00:00' })],
        sha256Hex,
      ),
    ).rejects.toThrow();
  });
});

describe('verifyPhotoHashChain — clean', () => {
  it('returns empty findings for a chain we just built', async () => {
    const chain = await buildHashChain(
      [
        input({ photoId: 'a', contentSha256: '1'.repeat(64) }),
        input({ photoId: 'b', contentSha256: '2'.repeat(64), capturedAt: '2026-05-22T15:30:00Z' }),
      ],
      sha256Hex,
    );
    const findings = await verifyPhotoHashChain(chain, sha256Hex);
    expect(findings).toEqual([]);
  });
});

describe('verifyPhotoHashChain — tamper detection', () => {
  it('catches a swapped contentSha256', async () => {
    const chain = await buildHashChain(
      [input({ photoId: 'a', contentSha256: '1'.repeat(64) })],
      sha256Hex,
    );
    // Pretend an attacker rewrites the bytes pointer.
    chain[0]!.contentSha256 = '9'.repeat(64);
    const findings = await verifyPhotoHashChain(chain, sha256Hex);
    expect(findings.some((f) => f.kind === 'ENTRY_HASH_MISMATCH')).toBe(true);
  });

  it('catches a reorder (broken prev pointer downstream)', async () => {
    const a = input({ photoId: 'a', contentSha256: '1'.repeat(64) });
    const b = input({ photoId: 'b', contentSha256: '2'.repeat(64), capturedAt: '2026-05-22T15:30:00Z' });
    const c = input({ photoId: 'c', contentSha256: '3'.repeat(64), capturedAt: '2026-05-22T16:00:00Z' });
    const chain = await buildHashChain([a, b, c], sha256Hex);
    // Swap b and c order without re-deriving entryHashes.
    const reordered = [chain[0]!, chain[2]!, chain[1]!];
    const findings = await verifyPhotoHashChain(reordered, sha256Hex);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('catches an index mismatch (deletion gap)', async () => {
    const a = input({ photoId: 'a', contentSha256: '1'.repeat(64) });
    const b = input({ photoId: 'b', contentSha256: '2'.repeat(64), capturedAt: '2026-05-22T15:30:00Z' });
    const chain = await buildHashChain([a, b], sha256Hex);
    // Drop the second entry but leave its successor in place at index 1
    // (carrying an index that no longer matches its position).
    const partial = [chain[0]!, { ...chain[1]!, index: 5 }];
    const findings = await verifyPhotoHashChain(partial, sha256Hex);
    expect(findings.some((f) => f.kind === 'INDEX_MISMATCH')).toBe(true);
  });
});

describe('isShapeValid', () => {
  it('true on a well-formed chain', async () => {
    const chain = await buildHashChain([input()], sha256Hex);
    expect(isShapeValid(chain)).toBe(true);
  });

  it('false when a prev pointer is garbage', async () => {
    const chain = await buildHashChain([input()], sha256Hex);
    chain[0]!.prevEntryHash = 'not-a-hash';
    expect(isShapeValid(chain)).toBe(false);
  });
});
