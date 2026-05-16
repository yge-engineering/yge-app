'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Totals {
  customers: number | null;
  vendors: number | null;
  jobs: number | null;
  employees: number | null;
}

export function TotalsPanel() {
  const [totals, setTotals] = useState<Totals>({ customers: null, vendors: null, jobs: null, employees: null });

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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Customers" href="/customers" value={totals.customers} />
      <Tile label="Vendors" href="/vendors" value={totals.vendors} />
      <Tile label="Jobs" href="/jobs" value={totals.jobs} />
      <Tile label="Employees" href="/employees" value={totals.employees} />
    </div>
  );
}

function Tile({ label, href, value }: { label: string; href: string; value: number | null }) {
  return (
    <Link href={href} className="block rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm hover:border-yge-blue-300">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-yge-blue-900">{value === null ? '…' : value}</div>
    </Link>
  );
}
