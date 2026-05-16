'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; billingAddressLine?: string | null; }
interface Vendor { id: string; state?: string | null; kind?: string | null; phone?: string | null; }
interface Job { id: string; status?: string | null; ownerAgency?: string | null; jobNumber?: string | null; }
interface Employee { id: string; classification?: string | null; rateType?: string | null; hireDate?: string | null; }

interface Row {
  label: string;
  missing: number;
  total: number;
}

export function PrintMissingPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { customers: [] })).then((j: { customers?: Customer[] }) => j.customers ?? []),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { vendors: [] })).then((j: { vendors?: Vendor[] }) => j.vendors ?? []),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: Job[] }) => j.jobs ?? []),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { employees: [] })).then((j: { employees?: Employee[] }) => j.employees ?? []),
      ]);
      setRows([
        {
          label: 'Customers',
          missing:
            c.filter((x) => !x.email).length +
            c.filter((x) => !x.phone).length +
            c.filter((x) => !x.billingAddressLine).length,
          total: c.length,
        },
        {
          label: 'Vendors',
          missing:
            v.filter((x) => !x.state).length +
            v.filter((x) => !x.kind).length +
            v.filter((x) => !x.phone).length,
          total: v.length,
        },
        {
          label: 'Jobs',
          missing:
            j.filter((x) => !x.status).length +
            j.filter((x) => !x.ownerAgency).length +
            j.filter((x) => !x.jobNumber).length,
          total: j.length,
        },
        {
          label: 'Employees',
          missing:
            e.filter((x) => !x.classification).length +
            e.filter((x) => !x.rateType).length +
            e.filter((x) => !x.hireDate).length,
          total: e.length,
        },
      ]);
    }
    load().catch(() => setRows([]));
  }, []);

  if (!rows) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-left text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2">Entity</th>
          <th className="py-2 text-right">Missing-field cells</th>
          <th className="py-2 text-right">Records</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-2 font-medium text-gray-900">{r.label}</td>
            <td className="py-2 text-right font-mono font-semibold">{r.missing}</td>
            <td className="py-2 text-right font-mono">{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
