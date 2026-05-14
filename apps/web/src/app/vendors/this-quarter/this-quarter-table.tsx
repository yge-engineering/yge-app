'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  createdAt?: string;
  legalName?: string;
  kind?: string;
  email?: string;
  data?: { legalName?: string; kind?: string; email?: string };
}

function nm(v: Vendor): string { return (v.legalName ?? v.data?.legalName ?? v.id) || v.id; }
function kn(v: Vendor): string { return (v.kind ?? v.data?.kind ?? '—') || '—'; }
function em(v: Vendor): string { return (v.email ?? v.data?.email ?? '—') || '—'; }

export function ThisQuarterTable() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) return <p className="text-sm text-gray-500">Loading…</p>;
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const qStart = new Date(year, (q - 1) * 3, 1).toISOString().slice(0, 10);
  const qEnd = new Date(year, q * 3, 1).toISOString().slice(0, 10);
  const rows = vendors
    .filter((v) => {
      const w = (v.createdAt ?? '').slice(0, 10);
      return w >= qStart && w < qEnd;
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No vendors added in {year} Q{q}.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(v.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2">
                <Link href={`/vendors/${v.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {nm(v)}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{kn(v)}</td>
              <td className="px-3 py-2 text-xs text-gray-700">{em(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
