'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  name?: string | null;
  hireDate?: string | null;
}

function yearKey(d?: string | null): string {
  if (!d) return 'unknown';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'unknown';
  return String(dt.getUTCFullYear());
}

export function PrintYearHiredDetailPanel() {
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
    const k = yearKey(e.hireDate);
    const list = grouped.get(k);
    if (list) list.push(e);
    else grouped.set(k, [e]);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return a[0] < b[0] ? 1 : -1;
  });

  if (sections.length === 0) {
    return <p className="text-xs text-gray-500">No employees yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([y, list]) => (
        <section key={y} className="break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 font-mono text-sm font-semibold text-gray-900">
            {y} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="mt-1 space-y-0.5 text-xs">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="text-gray-900">{e.name ?? '— unnamed —'}</span>
                <span className="font-mono text-gray-500">{e.hireDate ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
