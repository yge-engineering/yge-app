'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  name?: string | null;
  kind?: string | null;
}

export function PrintKindDetailPanel() {
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
    const k = v.kind?.trim() || '— unknown —';
    const list = grouped.get(k);
    if (list) list.push(v);
    else grouped.set(k, [v]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  if (sections.length === 0) {
    return <p className="text-xs text-gray-500">No vendors yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([k, list]) => (
        <section key={k} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold text-gray-900">
            {k} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((v) => (
              <li key={v.id} className="text-gray-900">{v.name ?? '— unnamed —'}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
