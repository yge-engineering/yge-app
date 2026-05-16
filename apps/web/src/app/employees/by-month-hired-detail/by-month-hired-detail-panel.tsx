'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  name?: string | null;
  hireDate?: string | null;
}

function monthKey(d?: string | null): string {
  if (!d) return 'unknown';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'unknown';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ByMonthHiredDetailPanel() {
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
    const k = monthKey(e.hireDate);
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
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">
        No employees yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map(([month, list]) => (
        <section key={month} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 font-mono text-sm text-yge-blue-900">
            {month} <span className="text-xs text-gray-500">({list.length})</span>
          </h2>
          <ul className="space-y-1">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-xs">
                <Link href={`/employees/${e.id}`} className="text-yge-blue-700 hover:underline">
                  {e.name ?? '— unnamed —'}
                </Link>
                <span className="font-mono text-gray-500">{e.hireDate ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
