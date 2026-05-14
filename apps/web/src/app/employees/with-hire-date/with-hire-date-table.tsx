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
  hireDate?: string | null;
}

export function WithHireDateTable() {
  const [emps, setEmps] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmps(j.employees ?? []));
  }, []);

  if (!emps) return <p className="text-sm text-gray-500">Loading…</p>;
  const rows = emps
    .filter((e) => (e.hireDate ?? '').trim().length > 0)
    .sort((a, b) => (b.hireDate ?? '').localeCompare(a.hireDate ?? ''));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No employees with a hire date set.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Hired</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Classification</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(e.hireDate ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2">
                <Link href={`/employees/${e.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.id}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{e.classification ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-700">{e.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
