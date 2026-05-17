'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  name?: string | null;
  classification?: string | null;
  rateType?: string | null;
}

export function PrintClassRateDetailPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmployees(j.employees ?? []));
  }, []);

  if (!employees) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const grouped = new Map<string, Employee[]>();
  for (const e of employees) {
    const c = e.classification ?? '— unknown —';
    const r = e.rateType ?? '— unknown —';
    const k = `${c}  ·  ${r}`;
    const list = grouped.get(k);
    if (list) list.push(e);
    else grouped.set(k, [e]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  if (sections.length === 0) {
    return <p className="text-xs text-gray-500">No employees yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([key, list]) => (
        <section key={key} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold text-gray-900">
            {key} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((e) => (
              <li key={e.id} className="text-gray-900">{e.name ?? '— unnamed —'}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
