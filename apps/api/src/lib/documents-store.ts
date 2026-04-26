// File-based store for document metadata.
//
// Phase 1 only stores the metadata + a URL/path pointing at where the
// PDF actually lives (Drive, SharePoint, Bluebeam Studio, a local
// path). The real upload + signed-URL + virus-scan layer lands in a
// later doc-vault module — this module's surface is the scaffold.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DocumentSchema,
  newDocumentId,
  normalizeTag,
  type Document,
  type DocumentCreate,
  type DocumentPatch,
} from '@yge/shared';

function dataDir(): string {
  return (
    process.env.DOCUMENTS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'documents')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Document[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = DocumentSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((d): d is Document => d !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Document[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

function sanitizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const norm = normalizeTag(t);
    if (norm.length === 0 || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

export async function createDocument(input: DocumentCreate): Promise<Document> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newDocumentId();
  const d: Document = {
    id,
    createdAt: now,
    updatedAt: now,
    tags: sanitizeTags(input.tags),
    ...input,
  };
  // Re-apply tag sanitization on the merged object so the spread can't
  // overwrite our tag list with the raw input.
  d.tags = sanitizeTags(input.tags);
  DocumentSchema.parse(d);
  await fs.writeFile(rowPath(id), JSON.stringify(d, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(d);
  await writeIndex(index);
  return d;
}

export async function listDocuments(filter?: {
  jobId?: string;
  kind?: string;
  tag?: string;
}): Promise<Document[]> {
  let all = await readIndex();
  if (filter?.jobId) {
    all = all.filter((d) => d.jobId === filter.jobId);
  }
  if (filter?.kind) {
    all = all.filter((d) => d.kind === filter.kind);
  }
  if (filter?.tag) {
    const t = normalizeTag(filter.tag);
    all = all.filter((d) => d.tags.includes(t));
  }
  // Sort by documentDate desc when present, falling back to createdAt.
  all.sort((a, b) => {
    const ad = a.documentDate ?? a.createdAt.slice(0, 10);
    const bd = b.documentDate ?? b.createdAt.slice(0, 10);
    return bd.localeCompare(ad);
  });
  return all;
}

export async function getDocument(id: string): Promise<Document | null> {
  if (!/^doc-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return DocumentSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateDocument(
  id: string,
  patch: DocumentPatch,
): Promise<Document | null> {
  const existing = await getDocument(id);
  if (!existing) return null;
  const updated: Document = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    tags: patch.tags !== undefined ? sanitizeTags(patch.tags) : existing.tags,
  };
  DocumentSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((d) => d.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
