'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Material {
  id: string;
  createdAt?: string;
  name?: string | null;
  category?: string | null;
  uom?: string | null;
}

export function RecentMaterialsTable() {
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

  const recent = [...materials]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 25);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">UoM</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((m) => (
            <tr key={m.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(m.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2 font-semibold">
                <Link href={`/materials/${m.id}`} className="text-yge-blue-700 hover:underline">
                  {m.name ?? m.id}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{m.category ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{m.uom ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
