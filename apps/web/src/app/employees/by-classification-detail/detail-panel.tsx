'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  firstName?: string;
  lastName?: string;
  classification?: string | null;
  status?: string | null;
}

export function ByClassDetail() {
  const [emps, setEmps] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmps(j.employees ?? []));
  }, []);

  if (!emps) return <p className="text-sm text-gray-500">Loading…</p>;
  if (emps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No employees in the database yet.
      </p>
    );
  }

  const groups = new Map<string, Employee[]>();
  for (const e of emps) {
    const k = (e.classification ?? '').trim() || '(unclassified)';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([cls, list]) => (
        <details key={cls} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-semibold text-gray-900">{cls}</span>
            <span className="text-xs text-gray-600">{list.length} employee{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {[...list].sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? '')).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/employees/${e.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.id}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">{e.status ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
