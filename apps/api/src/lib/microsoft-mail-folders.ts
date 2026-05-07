// Outlook mail-folder helpers.
//
// Plain English:
//   - listChildFolders(email, parent) returns the folders directly
//     under <parent> in the user's mailbox.
//   - ensureMailFolder(email, path) creates the folders along the
//     "Inbox/Jobs/<projectName>" path if they don't already exist
//     and returns the leaf folder id.
//   - moveMessage(email, messageId, destinationId) does the server-
//     side move via Graph's /messages/{id}/move action.

import { graphGet, graphPost } from './microsoft-graph';

interface GraphFolder {
  id: string;
  displayName: string;
}

interface FolderListResponse {
  value: GraphFolder[];
}

/** List child folders of `parentId` (or all root folders when
 *  parentId is null/undefined). */
export async function listChildFolders(
  email: string,
  parentId: string | null,
): Promise<GraphFolder[]> {
  const path = parentId
    ? `/me/mailFolders/${encodeURIComponent(parentId)}/childFolders?$top=100`
    : `/me/mailFolders?$top=100`;
  const res = await graphGet<FolderListResponse>(email, path);
  return res.value;
}

/** Find a child folder of `parentId` whose displayName matches
 *  exactly. Returns null when not found. */
export async function findChildFolder(
  email: string,
  parentId: string | null,
  displayName: string,
): Promise<GraphFolder | null> {
  const all = await listChildFolders(email, parentId);
  return (
    all.find(
      (f) => f.displayName.trim().toLowerCase() === displayName.trim().toLowerCase(),
    ) ?? null
  );
}

/** Create a child folder under `parentId` with the given displayName. */
async function createChildFolder(
  email: string,
  parentId: string,
  displayName: string,
): Promise<GraphFolder> {
  return graphPost<GraphFolder>(
    email,
    `/me/mailFolders/${encodeURIComponent(parentId)}/childFolders`,
    { displayName },
  );
}

/** Resolve the "Inbox" folder id once per request. */
async function inboxId(email: string): Promise<string> {
  const inbox = await graphGet<GraphFolder>(email, '/me/mailFolders/inbox');
  return inbox.id;
}

/** Find-or-create a folder path under Inbox. Path segments are
 *  joined like "Jobs/<projectName>". Returns the leaf folder id. */
export async function ensureMailFolder(
  email: string,
  pathSegments: string[],
): Promise<string> {
  if (pathSegments.length === 0) {
    throw new Error('ensureMailFolder requires at least one segment');
  }
  let parent: string = await inboxId(email);
  for (const segment of pathSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const found = await findChildFolder(email, parent, trimmed);
    if (found) {
      parent = found.id;
    } else {
      const created = await createChildFolder(email, parent, trimmed);
      parent = created.id;
    }
  }
  return parent;
}

/** Move a message to the specified destination folder. Returns the
 *  moved message's new id (Graph rewrites it). */
export async function moveMessage(
  email: string,
  messageId: string,
  destinationId: string,
): Promise<{ newMessageId: string } | null> {
  try {
    const res = await graphPost<{ id: string }>(
      email,
      `/me/messages/${encodeURIComponent(messageId)}/move`,
      { destinationId },
    );
    return { newMessageId: res.id };
  } catch (err) {
    // Already moved or message gone — treat as a no-op.
    const msg = (err as Error).message;
    if (msg.includes('404')) return null;
    throw err;
  }
}

/** Build a stable folder name for a job. */
export function jobFolderName(opts: {
  projectName: string;
  jobNumber?: string;
}): string {
  const base = opts.projectName.trim().replace(/[\\/:*?"<>|]/g, '-');
  if (opts.jobNumber && opts.jobNumber.trim()) {
    return `${opts.jobNumber.trim()} ${base}`.slice(0, 200);
  }
  return base.slice(0, 200);
}
