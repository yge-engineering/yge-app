'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; billingAddressLine?: string | null; }
interface Vendor { id: string; state?: string | null; kind?: string | null; phone?: string | null; }
interface Job { id: string; status?: string | null; ownerAgency?: string | null; jobNumber?: string | null; }
interface Employee { id: string; classification?: string | null; rateType?: string | null; hireDate?: string | null; }

interface Counts {
  customers: { missing: number; total: number };
  vendors: { missing: number; total: number };
  jobs: { missing: number; total: number };
  employees: { missing: number; total: number };
}

export function MissingPanel() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { customers: [] })).then((j: { customers?: Customer[] }) => j.customers ?? []),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { vendors: [] })).then((j: { vendors?: Vendor[] }) => j.vendors ?? []),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: Job[] }) => j.jobs ?? []),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { employees: [] })).then((j: { employees?: Employee[] }) => j.employees ?? []),
      ]);
      setCounts({
        customers: {
          missing:
            c.filter((x) => !x.email).length +
            c.filter((x) => !x.phone).length +
            c.filter((x) => !x.billingAddressLine).length,
          total: c.length,
        },
        vendors: {
          missing:
            v.filter((x) => !x.state).length +
            v.filter((x) => !x.kind).length +
            v.filter((x) => !x.phone).length,
          total: v.length,
        },
        jobs: {
          missing:
            j.filter((x) => !x.status).length +
            j.filter((x) => !x.ownerAgency).length +
            j.filter((x) => !x.jobNumber).length,
          total: j.length,
        },
        employees: {
          missing:
            e.filter((x) => !x.classification).length +
            e.filter((x) => !x.rateType).length +
            e.filter((x) => !x.hireDate).length,
          total: e.length,
        },
      });
    }
    load().catch(() => setCounts(null));
  }, []);

  if (!counts) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Customers missing" href="/customers/missing-email" value={counts.customers.missing} total={counts.customers.total} />
      <Tile label="Vendors missing" href="/vendors/missing-state" value={counts.vendors.missing} total={counts.vendors.total} />
      <Tile label="Jobs missing" href="/jobs/missing-status" value={counts.jobs.missing} total={counts.jobs.total} />
      <Tile label="Employees missing" href="/employees/missing-classification" value={counts.employees.missing} total={counts.employees.total} />
    </div>
  );
}

function Tile({ label, href, value, total }: { label: string; href: string; value: number; total: number }) {
  const tone = value === 0 ? 'good' : value < 5 ? 'warn' : 'bad';
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-red-700';
  return (
    <Link href={href} className="block rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm hover:border-yge-blue-300">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-gray-500">across {total} records</div>
    </Link>
  );
}
