'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Material {
  id: string;
  name?: string | null;
  category?: string | null;
  uom?: string | null;
}

export function ByCategoryDetail() {
  const [materials, setMaterials] = useState<Material[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/materials`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { materials: [] }))
      .then((j: { materials?: Material[] }) => setMaterials(j.materials ?? []));
  }, []);

  if (!materials) return <p className="text-sm text-gray-500">Loading…</p>;
  if (materials.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No materials in the database yet.
      </p>
    );
  }

  const groups = new Map<string, Material[]>();
  for (const m of materials) {
    const k = (m.category ?? '').trim().toUpperCase() || '(unknown)';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([cat, list]) => (
        <details key={cat} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{cat}</span>
            <span className="text-xs text-gray-600">{list.length} material{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {[...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/materials/${m.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {m.name ?? m.id}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">{m.uom ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
