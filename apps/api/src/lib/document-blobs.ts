// Document blob storage — actual file bytes for uploaded documents.
//
// Plain English: when a user uploads a file in the /files explorer,
// the bytes land here on the API's persistent disk. Two slots:
//   data/document-blobs/<docId>           — the raw bytes
//   data/document-blobs/<docId>.meta.json — { mimeType, size, name }
//
// Phase 1 quirk: we store on the Render persistent disk (1 GB cap).
// For larger files / longer term, Phase 2 migrates to Supabase
// Storage; the API surface stays the same so callers don't have to
// change.

import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';

function dataDir(): string {
  return (
    process.env.DOCUMENT_BLOBS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'document-blobs')
  );
}
function blobPath(id: string): string {
  return path.join(dataDir(), id);
}
function metaPath(id: string): string {
  return path.join(dataDir(), `${id}.meta.json`);
}

export interface BlobMeta {
  mimeType: string;
  size: number;
  originalFileName: string;
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function writeBlob(
  id: string,
  bytes: Buffer,
  meta: BlobMeta,
): Promise<void> {
  await ensureDir();
  await fs.writeFile(blobPath(id), bytes);
  await fs.writeFile(metaPath(id), JSON.stringify(meta, null, 2), 'utf8');
}

export async function readBlobMeta(id: string): Promise<BlobMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(id), 'utf8');
    return JSON.parse(raw) as BlobMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Return a Node Readable stream for the blob bytes, or null if it
 *  doesn't exist. Caller is responsible for piping to the response. */
export function blobStream(id: string): ReturnType<typeof createReadStream> | null {
  const p = blobPath(id);
  // We don't pre-stat for existence — the stream errors out cleanly
  // if the file is missing, and the caller can hand a 404 to the
  // client at that point.
  return createReadStream(p);
}

export async function deleteBlob(id: string): Promise<void> {
  await fs.unlink(blobPath(id)).catch(() => undefined);
  await fs.unlink(metaPath(id)).catch(() => undefined);
}

export async function blobExists(id: string): Promise<boolean> {
  try {
    await fs.stat(blobPath(id));
    return true;
  } catch {
    return false;
  }
}
