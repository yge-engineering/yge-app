// OneDrive helpers — high-level wrappers around Microsoft Graph for
// folder + file operations in the user's personal OneDrive.
//
// All segments under /me/drive (personal OneDrive). For SharePoint
// site drives, use the same primitives but with /sites/{id}/drive
// or /drives/{id} paths.

import { graphGet, graphGetBinary, graphPost } from './microsoft-graph';
import { Readable } from 'node:stream';

export interface DriveItem {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { driveId?: string; id?: string; path?: string };
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

/**
 * Resolve a "YGE Jobs/<job>/RFIs" path to a DriveItem. Returns null
 * if any segment doesn't exist. Path is relative to the user's
 * OneDrive root. Leading slash optional.
 */
export async function findByPath(
  email: string,
  path: string,
): Promise<DriveItem | null> {
  const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) {
    // Root.
    return graphGet<DriveItem>(email, '/me/drive/root');
  }
  try {
    return await graphGet<DriveItem>(
      email,
      `/me/drive/root:/${encodeURIPath(clean)}`,
    );
  } catch (err) {
    if (
      err instanceof Error &&
      /itemNotFound|404|not.?found/i.test(err.message)
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Idempotently ensure every folder segment in `path` exists,
 * creating missing ones. Returns the leaf folder's DriveItem.
 * Slashes in segment names are NOT supported (a real Windows /
 * macOS limitation we don't fight).
 */
export async function ensureFolderPath(
  email: string,
  path: string,
): Promise<DriveItem> {
  const segments = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((s) => s.length > 0);
  if (segments.length === 0) {
    return graphGet<DriveItem>(email, '/me/drive/root');
  }

  let parentItem = await graphGet<DriveItem>(email, '/me/drive/root');
  let currentPath = '';
  for (const seg of segments) {
    currentPath = currentPath ? `${currentPath}/${seg}` : seg;
    // Try resolve.
    const existing = await findByPath(email, currentPath);
    if (existing && existing.folder) {
      parentItem = existing;
      continue;
    }
    // Create under parentItem.
    const created = await graphPost<DriveItem>(
      email,
      `/me/drive/items/${parentItem.id}/children`,
      {
        name: seg,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      },
    );
    parentItem = created;
  }
  return parentItem;
}

/**
 * Upload bytes as a new file under `parentItemId` with the given
 * name. For files under 4MB we use the simple PUT /content endpoint;
 * larger files use a Graph upload session (not yet implemented —
 * throws if bytes.length > 4*1024*1024).
 */
export async function uploadFile(
  email: string,
  parentItemId: string,
  name: string,
  bytes: Uint8Array | Buffer,
  contentType: string,
): Promise<DriveItem> {
  const size = bytes.byteLength;
  if (size > 4 * 1024 * 1024) {
    throw new Error(
      `uploadFile: file too large (${size} bytes). Upload session for >4MB not yet implemented.`,
    );
  }
  // Conflict behavior: replace if a file by that name already exists.
  const path = `/me/drive/items/${parentItemId}:/${encodeURIPath(name)}:/content?@microsoft.graph.conflictBehavior=replace`;
  // We use the raw fetch through getAccessTokenFor + manual PUT.
  // graphGet/graphPost both go through Bearer auth; we need a PUT
  // with binary body. Add a small helper here.
  const { getAccessTokenFor } = await import('./microsoft-graph');
  const token = await getAccessTokenFor(email);
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `OneDrive upload failed (${res.status}): ${errBody.slice(0, 300)}`,
    );
  }
  return (await res.json()) as DriveItem;
}

/**
 * Download a file's bytes from OneDrive by item id.
 */
export async function downloadFile(
  email: string,
  itemId: string,
): Promise<{ bytes: Uint8Array; name: string; contentType: string }> {
  // Get metadata first to know name + contentType.
  const meta = await graphGet<DriveItem>(email, `/me/drive/items/${itemId}`);
  const bin = await graphGetBinary(email, `/me/drive/items/${itemId}/content`);
  return {
    bytes: bin.bytes,
    name: meta.name,
    contentType: meta.file?.mimeType ?? bin.contentType ?? 'application/octet-stream',
  };
}

/**
 * List children of a folder. If parentItemId is undefined, lists the
 * OneDrive root.
 */
export async function listChildren(
  email: string,
  parentItemId?: string,
  opts?: { top?: number },
): Promise<DriveItem[]> {
  const top = Math.min(opts?.top ?? 50, 200);
  const segment = parentItemId
    ? `/me/drive/items/${parentItemId}/children`
    : '/me/drive/root/children';
  const data = await graphGet<{ value: DriveItem[] }>(
    email,
    `${segment}?$top=${top}`,
  );
  return data.value;
}

/**
 * URL-encode each path segment (preserving slashes between segments).
 * Microsoft Graph wants segments URL-encoded but the slashes themselves
 * un-escaped.
 */
function encodeURIPath(p: string): string {
  return p
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * Convert a job to the canonical OneDrive folder path: "YGE Jobs/<jobNumber> - <projectName>".
 * Sanitizes forbidden characters (\\/:*?"<>| → -).
 */
export function jobFolderPath(jobNumber: string, projectName: string): string {
  const safe = (s: string) =>
    s.replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `YGE Jobs/${safe(jobNumber)} - ${safe(projectName)}`;
}
