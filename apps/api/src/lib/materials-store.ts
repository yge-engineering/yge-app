// File-based store for materials + their movement ledger.
//
// Movement records always update quantityOnHand atomically with the
// ledger append, so the cached value never drifts from the truth.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  MaterialSchema,
  applyMovement,
  newMaterialId,
  newStockMovementId,
  type Material,
  type MaterialCreate,
  type MaterialPatch,
  type StockMovement,
  type StockMovementCreate,
} from '@yge/shared';

function dataDir(): string {
  return (
    process.env.MATERIALS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'materials')
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

async function readIndex(): Promise<Material[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = MaterialSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((m): m is Material => m !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Material[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createMaterial(input: MaterialCreate): Promise<Material> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newMaterialId();
  const m: Material = {
    id,
    createdAt: now,
    updatedAt: now,
    movements: input.movements ?? [],
    quantityOnHand: input.quantityOnHand ?? 0,
    ...input,
  };
  MaterialSchema.parse(m);
  await fs.writeFile(rowPath(id), JSON.stringify(m, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(m);
  await writeIndex(index);
  return m;
}

export async function listMaterials(filter?: {
  category?: string;
  belowReorder?: boolean;
}): Promise<Material[]> {
  let all = await readIndex();
  if (filter?.category) all = all.filter((m) => m.category === filter.category);
  if (filter?.belowReorder) {
    all = all.filter(
      (m) => m.reorderPoint !== undefined && m.quantityOnHand <= m.reorderPoint,
    );
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  return all;
}

export async function getMaterial(id: string): Promise<Material | null> {
  if (!/^mat-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return MaterialSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateMaterial(
  id: string,
  patch: MaterialPatch,
): Promise<Material | null> {
  const existing = await getMaterial(id);
  if (!existing) return null;
  const updated: Material = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  MaterialSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((m) => m.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}

/** Append a stock movement and update quantityOnHand atomically. */
export async function recordMovement(
  id: string,
  movement: StockMovementCreate,
): Promise<Material | null> {
  const existing = await getMaterial(id);
  if (!existing) return null;
  const fullMovement: StockMovement = {
    id: newStockMovementId(),
    recordedAt: new Date().toISOString(),
    ...movement,
  };
  const newQty = applyMovement(existing.quantityOnHand, fullMovement);
  return updateMaterial(id, {
    movements: [...existing.movements, fullMovement],
    quantityOnHand: newQty,
  });
}
