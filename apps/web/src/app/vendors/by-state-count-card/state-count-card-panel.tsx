'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Vendor {
  id: string;
  state?: string | null;
}

export function StateCountCardPanel() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { vendors: [] }))
      .then((j: { vendors?: Vendor[] }) => setVendors(j.vendors ?? []));
  }, []);

  if (!vendors) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const states = new Set<string>();
  let missing = 0;
  for (const v of vendors) {
    const s = v.state?.trim().toUpperCase();
    if (!s) {
      missing += 1;
    } else {
      states.add(s);
    }
  }
  const count = states.size;
  const tone = count >= 5 ? 'good' : count >= 2 ? 'warn' : 'bad';

  return (
    <section className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center shadow-sm">
      <div className={`text-6xl font-extrabold tracking-tighter ${tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : 'text-red-800'}`}>
        {count}
      </div>
      <p className="mt-2 text-sm text-yge-blue-900">
        distinct state{count === 1 ? '' : 's'} across {vendors.length} vendor{vendors.length === 1 ? '' : 's'}.
      </p>
      <p className="mt-1 text-[11px] text-yge-blue-700">
        {missing} vendor{missing === 1 ? '' : 's'} have no state on file.
      </p>
    </section>
  );
}
