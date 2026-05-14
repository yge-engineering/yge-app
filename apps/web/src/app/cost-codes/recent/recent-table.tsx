'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CostCode {
  id: string;
  createdAt?: string;
  code?: string | null;
  description?: string | null;
}

export function RecentCostCodesTable() {
  const [codes, setCodes] = useState<CostCode[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { costCodes: [] }))
      .then((j: { costCodes?: CostCode[] }) => setCodes(j.costCodes ?? []));
  }, []);

  if (!codes) return <p className="text-sm text-gray-500">Loading…</p>;
  if (codes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No cost codes in the database yet.
      </p>
    );
  }

  const recent = [...codes]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 25);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((c) => (
            <tr key={c.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(c.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">
                <Link href={`/cost-codes/${c.id}`} className="text-yge-blue-700 hover:underline">
                  {c.code ?? '—'}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-900">{c.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
