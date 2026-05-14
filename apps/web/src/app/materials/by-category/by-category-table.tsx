'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Material { id: string; category?: string | null }

export function ByCategoryTable() {
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

  const counts = new Map<string, number>();
  for (const m of materials) {
    const k = (m.category ?? '').trim().toUpperCase() || '(unknown)';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = materials.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2 text-right">Materials</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cat, count]) => (
            <tr key={cat} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{cat}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
