'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  name?: string | null;
  phone?: string | null;
}

function areaCode(phone?: string | null): string {
  if (!phone) return 'unknown';
  const digits = phone.replace(/\D+/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10, -7);
  }
  if (digits.length >= 3) {
    return digits.slice(0, 3);
  }
  return 'unknown';
}

export function AreaCodeDetailPanel() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const grouped = new Map<string, Vendor[]>();
  for (const v of vendors) {
    const k = areaCode(v.phone);
    const list = grouped.get(k);
    if (list) list.push(v);
    else grouped.set(k, [v]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  if (sections.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
        No vendors yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(([code, list]) => (
        <section key={code} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 font-mono text-sm text-yge-blue-900">
            {code} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="space-y-1">
            {list.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-xs">
                <Link href={`/vendors/${v.id}`} className="text-yge-blue-700 hover:underline">
                  {v.name ?? '— unnamed —'}
                </Link>
                <span className="font-mono text-gray-500">{v.phone ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
