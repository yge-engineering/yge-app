'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  legalName?: string;
  kind?: string;
  phone?: string;
  data?: { legalName?: string; kind?: string; phone?: string };
}

function nm(v: Vendor): string { return (v.legalName ?? v.data?.legalName ?? v.id) || v.id; }
function kn(v: Vendor): string { return (v.kind ?? v.data?.kind ?? '—') || '—'; }
function ph(v: Vendor): string { return (v.phone ?? v.data?.phone ?? '') || ''; }

export function WithPhoneTable() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) return <p className="text-sm text-gray-500">Loading…</p>;
  const rows = vendors.filter((v) => ph(v).trim().length > 0);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No vendors with a phone on file yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Phone</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-gray-100">
              <td className="px-3 py-2">
                <Link href={`/vendors/${v.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {nm(v)}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{kn(v)}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{ph(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
