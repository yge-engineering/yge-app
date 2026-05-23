// Hash-chained photo evidence.
//
// Phase 1 gap-list item: "Photo hash-chained storage (Merkle-style)
// on uploads". Each photo gets a SHA-256 of its bytes at upload time
// (the existing photos store already computes this — that's the
// `contentSha256` field). This module threads those per-photo hashes
// into a tamper-evident CHAIN where each entry's `entryHash` includes
// the previous entry's `entryHash` in its input.
//
// Tamper-evidence properties:
//   - Insert a photo in the middle → entryHash mismatches downstream.
//   - Swap a photo's bytes → contentSha256 mismatches → entryHash
//     mismatches downstream.
//   - Reorder photos → entryHashes mismatch.
//   - Delete a photo → next entry's prev pointer no longer matches.
//
// The chain is NOT a Merkle TREE (which would let us prove inclusion
// of a single photo without revealing the rest). It's a Merkle CHAIN
// (linked list) which is the simpler / cheaper structure when the
// audit ask is "show me this job's whole photo log."
//
// Pure: hashing delegated to the caller (sha256Hex helper from
// signature.ts works in browser + Node). This module just composes
// the inputs into the chain shape.

import { z } from 'zod';

const HEX_64 = /^[0-9a-f]{64}$/;
const SHA_OR_GENESIS = /^(?:[0-9a-f]{64}|GENESIS)$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const PhotoChainEntryInputSchema = z.object({
  photoId: z.string().min(1),
  /** SHA-256 of the photo bytes, lowercase hex. */
  contentSha256: z.string().regex(HEX_64, 'Expected 64-char lowercase hex'),
  /** Server-stamped capture/upload time. ISO-8601 UTC. */
  capturedAt: z.string().regex(ISO_DATE_TIME, 'Use ISO-8601 UTC (e.g. 2026-05-23T08:30:00Z)'),
  /** Optional context for the chain (the entry hash binds it). */
  jobId: z.string().max(120).optional(),
  uploaderId: z.string().max(120).optional(),
});
export type PhotoChainEntryInput = z.infer<typeof PhotoChainEntryInputSchema>;

export interface PhotoChainEntry extends PhotoChainEntryInput {
  index: number;
  /** Previous entry's entryHash. 'GENESIS' for index 0. */
  prevEntryHash: string;
  /** sha256(prevEntryHash + '|' + photoId + '|' + contentSha256 + '|' +
   *  capturedAt + '|' + (jobId ?? '') + '|' + (uploaderId ?? '')). */
  entryHash: string;
}

export type Sha256Hex = (input: string) => Promise<string>;

/** Build the chain from a list of inputs in CHRONOLOGICAL ORDER.
 *  Caller supplies the hash function so this module stays
 *  isomorphic (signature.ts has one that works in both runtimes). */
export async function buildHashChain(
  inputs: PhotoChainEntryInput[],
  sha256Hex: Sha256Hex,
): Promise<PhotoChainEntry[]> {
  // Defensive: parse each input through the schema so a caller
  // passing dirty data fails loudly at the boundary.
  const parsed = inputs.map((i) => PhotoChainEntryInputSchema.parse(i));
  const out: PhotoChainEntry[] = [];
  let prev = 'GENESIS';
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]!;
    const material = [
      prev,
      p.photoId,
      p.contentSha256,
      p.capturedAt,
      p.jobId ?? '',
      p.uploaderId ?? '',
    ].join('|');
    const entryHash = await sha256Hex(material);
    out.push({ ...p, index: i, prevEntryHash: prev, entryHash });
    prev = entryHash;
  }
  return out;
}

export type ChainTamperKind =
  | 'INDEX_MISMATCH'
  | 'PREV_POINTER_BROKEN'
  | 'ENTRY_HASH_MISMATCH';

export interface ChainTamperFinding {
  index: number;
  photoId: string;
  kind: ChainTamperKind;
  message: string;
}

/** Walk an EXISTING chain and verify it. Recomputes each entryHash
 *  with the supplied sha256Hex and compares. Returns the findings
 *  (empty array = clean). */
export async function verifyPhotoHashChain(
  chain: PhotoChainEntry[],
  sha256Hex: Sha256Hex,
): Promise<ChainTamperFinding[]> {
  const out: ChainTamperFinding[] = [];
  let expectedPrev = 'GENESIS';
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]!;
    if (e.index !== i) {
      out.push({
        index: i,
        photoId: e.photoId,
        kind: 'INDEX_MISMATCH',
        message: `entry at position ${i} carries index ${e.index}`,
      });
    }
    if (e.prevEntryHash !== expectedPrev) {
      out.push({
        index: i,
        photoId: e.photoId,
        kind: 'PREV_POINTER_BROKEN',
        message: `prev pointer is ${e.prevEntryHash.slice(0, 12)}… but should be ${expectedPrev.slice(0, 12)}…`,
      });
    }
    const material = [
      e.prevEntryHash,
      e.photoId,
      e.contentSha256,
      e.capturedAt,
      e.jobId ?? '',
      e.uploaderId ?? '',
    ].join('|');
    const expected = await sha256Hex(material);
    if (!HEX_64.test(e.entryHash) || e.entryHash !== expected) {
      out.push({
        index: i,
        photoId: e.photoId,
        kind: 'ENTRY_HASH_MISMATCH',
        message: `entryHash does not recompute from the entry's own fields`,
      });
    }
    expectedPrev = e.entryHash;
  }
  return out;
}

/** True when every entry's prevEntryHash is well-formed (HEX_64 or
 *  the literal 'GENESIS'). Defensive shape check the caller can run
 *  before invoking verifyPhotoHashChain. */
export function isShapeValid(chain: PhotoChainEntry[]): boolean {
  return chain.every(
    (e) =>
      HEX_64.test(e.entryHash) &&
      SHA_OR_GENESIS.test(e.prevEntryHash) &&
      HEX_64.test(e.contentSha256),
  );
}
