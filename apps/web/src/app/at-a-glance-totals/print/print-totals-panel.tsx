'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Totals {
  customers: number;
  vendors: number;
  jobs: number;
  employees: number;
}

export function PrintTotalsPanel() {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { customers: [] })).then((j: { customers?: unknown[] }) => j.customers?.length ?? 0),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { vendors: [] })).then((j: { vendors?: unknown[] }) => j.vendors?.length ?? 0),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: unknown[] }) => j.jobs?.length ?? 0),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { employees: [] })).then((j: { employees?: unknown[] }) => j.employees?.length ?? 0),
      ]);
      setTotals({ customers: c, vendors: v, jobs: j, employees: e });
    }
    load().catch(() => setTotals({ customers: 0, vendors: 0, jobs: 0, employees: 0 }));
  }, []);

  if (!totals) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">Entity</th>
          <th className="py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        <tr><td className="py-2 font-medium text-gray-900">Customers</td><td className="py-2 text-right font-mono font-semibold">{totals.customers}</td></tr>
        <tr><td className="py-2 font-medium text-gray-900">Vendors</td><td className="py-2 text-right font-mono font-semibold">{totals.vendors}</td></tr>
        <tr><td className="py-2 font-medium text-gray-900">Jobs</td><td className="py-2 text-right font-mono font-semibold">{totals.jobs}</td></tr>
        <tr><td className="py-2 font-medium text-gray-900">Employees</td><td className="py-2 text-right font-mono font-semibold">{totals.employees}</td></tr>
      </tbody>
    </table>
  );
}
