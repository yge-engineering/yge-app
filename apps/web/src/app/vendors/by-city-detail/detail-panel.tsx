'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  legalName?: string;
  city?: string | null;
  state?: string | null;
  data?: { legalName?: string; city?: string | null; state?: string | null };
}

function nm(v: Vendor): string { return (v.legalName ?? v.data?.legalName ?? v.id) || v.id; }
function ci(v: Vendor): string { return ((v.city ?? v.data?.city) ?? '').trim(); }
function st(v: Vendor): string { return ((v.state ?? v.data?.state) ?? '').trim().toUpperCase(); }

export function ByCityDetail() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) return <p className="text-sm text-gray-500">Loading…</p>;
  if (vendors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No vendors in the database yet.
      </p>
    );
  }

  const groups = new Map<string, Vendor[]>();
  for (const v of vendors) {
    const city = ci(v);
    const state = st(v);
    const k = city && state ? `${city}, ${state}` : (city || state || '(unknown)');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(v);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([city, list]) => (
        <details key={city} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-semibold text-gray-900">{city}</span>
            <span className="text-xs text-gray-600">{list.length} vendor{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {list.map((v) => (
              <li key={v.id} className="py-1.5">
                <Link href={`/vendors/${v.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {nm(v)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
