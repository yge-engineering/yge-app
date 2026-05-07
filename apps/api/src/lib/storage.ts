// Supabase Storage REST wrapper.
//
// The web app + mobile app never call Supabase Storage directly —
// per CLAUDE.md ("Files go through the API"), every upload + read
// goes through this module so we can audit + permission-check.
//
// Buckets (created lazily on first use):
//   - yge-photos      : jobsite photos
//   - yge-docs        : contracts, scanned vendor invoices
//   - yge-extracts    : cached PDF text + AI parses
//
// The API uses the service-role key (server-only). The browser
// gets short-lived signed URLs to view objects, not the bucket
// itself.

import { randomBytes } from 'node:crypto';

export type StorageBucket = 'yge-photos' | 'yge-docs' | 'yge-extracts';

function projectUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url.replace(/\/$/, '');
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Storage operations need it.',
    );
  }
  return key;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceKey()}`,
    apikey: serviceKey(),
    ...extra,
  };
}

/** Generate a random object key with a stable prefix. */
export function newObjectKey(prefix: string, ext = 'bin'): string {
  const yyyy = new Date().toISOString().slice(0, 4);
  const mm = new Date().toISOString().slice(5, 7);
  const rand = randomBytes(8).toString('hex');
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'bin';
  return `${yyyy}/${mm}/${prefix}-${rand}.${safeExt}`;
}

/** Ensure a bucket exists. Idempotent — silently succeeds if already there. */
export async function ensureBucket(name: StorageBucket): Promise<void> {
  const res = await fetch(`${projectUrl()}/storage/v1/bucket/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (res.status === 200) return;
  // Create. Mark private so anonymous reads are blocked.
  const create = await fetch(`${projectUrl()}/storage/v1/bucket`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: name,
      name,
      public: false,
      file_size_limit: 50 * 1024 * 1024, // 50 MB per object
    }),
  });
  if (!create.ok && create.status !== 409) {
    const text = await create.text().catch(() => '');
    throw new Error(`Bucket create failed (${create.status}): ${text.slice(0, 200)}`);
  }
}

export interface UploadResult {
  bucket: StorageBucket;
  objectKey: string;
  size: number;
  contentType?: string;
}

export async function uploadObject(
  bucket: StorageBucket,
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<UploadResult> {
  await ensureBucket(bucket);
  const url = `${projectUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': contentType ?? 'application/octet-stream',
      'x-upsert': 'true',
    }),
    body: body as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return {
    bucket,
    objectKey,
    size: body.length,
    contentType,
  };
}

/** Generate a short-lived signed URL for browser fetch. */
export async function signedUrl(
  bucket: StorageBucket,
  objectKey: string,
  expiresInSeconds = 600,
): Promise<string> {
  const url = `${projectUrl()}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sign URL failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const path = json.signedURL ?? json.signedUrl;
  if (!path) throw new Error('Signed URL response missing signedURL field');
  // Supabase returns a relative path like /object/sign/...; prepend project.
  return `${projectUrl()}/storage/v1${path.startsWith('/') ? path : `/${path}`}`;
}

export async function deleteObject(
  bucket: StorageBucket,
  objectKey: string,
): Promise<void> {
  const url = `${projectUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Stream the object back as a Buffer. Mostly used by the API to re-feed
 *  PDFs into the AI extractor without round-tripping through the browser. */
export async function downloadObject(
  bucket: StorageBucket,
  objectKey: string,
): Promise<Buffer> {
  const url = `${projectUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
