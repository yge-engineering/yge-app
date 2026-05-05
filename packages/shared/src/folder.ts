// Folder — node in the YGE Files tree.
//
// Plain English: the folder hierarchy under /files is built from
// these. Each folder either lives at the root (parentFolderId = null)
// or under another folder. Folders can optionally link to a Job, so
// "Sulphur Springs / Plans" or "Sulphur Springs / Specs" auto-show
// up under the job's Files tab.
//
// A Document (see document.ts) gets a `folderId` field — that's how
// files get attached to a folder. Both folders and documents are
// independent records; deleting a folder soft-detaches its children
// (we surface them at the parent rather than orphaning them).

import { z } from 'zod';

export const FolderSchema = z.object({
  /** Stable id `fld-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  name: z.string().min(1).max(120),

  /** Parent folder id. null = root-level. */
  parentFolderId: z.string().nullable().default(null),

  /** Optional job link. The job's detail page can list folders that
   *  point at it. */
  jobId: z.string().max(120).optional(),

  /** Free-form description shown at the top of the folder pane. */
  description: z.string().max(2_000).optional(),

  /** User who created it (best-effort; from session cookie). */
  createdByUserId: z.string().max(120).optional(),
});
export type Folder = z.infer<typeof FolderSchema>;

export const FolderCreateSchema = FolderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FolderCreate = z.infer<typeof FolderCreateSchema>;

export const FolderPatchSchema = FolderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
  .partial()
  .strict();
export type FolderPatch = z.infer<typeof FolderPatchSchema>;

export function newFolderId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `fld-${hex.padStart(8, '0')}`;
}

/** Walk a flat list of folders into a tree. Folders with a missing
 *  parent (parent was deleted) get reparented to root. */
export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of folders) {
    byId.set(f.id, { folder: f, children: [] });
  }
  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = byId.get(f.id)!;
    if (f.parentFolderId && byId.has(f.parentFolderId)) {
      byId.get(f.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable alpha sort at every level so the UI doesn't shuffle on
  // refresh.
  const sortRecursive = (nodes: FolderNode[]) => {
    nodes.sort((a, b) =>
      a.folder.name.localeCompare(b.folder.name, undefined, { sensitivity: 'base' }),
    );
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}

/** Compute the breadcrumb path from root to the given folder.
 *  Returns an empty array when the folder is root-level. */
export function folderBreadcrumbs(
  folderId: string | null,
  folders: Folder[],
): Folder[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: Folder[] = [];
  let cursor = byId.get(folderId);
  // Guard against accidental cycles by limiting depth.
  let safety = 64;
  while (cursor && safety-- > 0) {
    out.unshift(cursor);
    cursor = cursor.parentFolderId ? byId.get(cursor.parentFolderId) : undefined;
  }
  return out;
}
