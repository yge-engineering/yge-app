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
  pct: number;
  filled: number;
  total: number;
}

export function PrintCompletenessPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { customers: [] })).then((j: { customers?: Customer[] }) => j.customers ?? []),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { vendors: [] })).then((j: { vendors?: Vendor[] }) => j.vendors ?? []),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: Job[] }) => j.jobs ?? []),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { employees: [] })).then((j: { employees?: Employee[] }) => j.employees ?? []),
      ]);

      function tally<T>(rows: T[], picks: Array<(r: T) => unknown>): { filled: number; total: number } {
        let filled = 0;
        let total = 0;
        for (const r of rows) {
          for (const p of picks) {
            total += 1;
            if (p(r)) filled += 1;
          }
        }
        return { filled, total };
      }

      const cT = tally(c, [(x) => x.email, (x) => x.phone, (x) => x.billingAddressLine]);
      const vT = tally(v, [(x) => x.state, (x) => x.kind, (x) => x.phone]);
      const jT = tally(j, [(x) => x.status, (x) => x.ownerAgency, (x) => x.jobNumber]);
      const eT = tally(e, [(x) => x.classification, (x) => x.rateType, (x) => x.hireDate]);

      setRows([
        { label: 'Customers', pct: cT.total === 0 ? 100 : (cT.filled / cT.total) * 100, ...cT },
        { label: 'Vendors', pct: vT.total === 0 ? 100 : (vT.filled / vT.total) * 100, ...vT },
        { label: 'Jobs', pct: jT.total === 0 ? 100 : (jT.filled / jT.total) * 100, ...jT },
        { label: 'Employees', pct: eT.total === 0 ? 100 : (eT.filled / eT.total) * 100, ...eT },
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
          <th className="py-2 text-right">Filled</th>
          <th className="py-2 text-right">Total cells</th>
          <th className="py-2 text-right">Completeness</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-2 font-medium text-gray-900">{r.label}</td>
            <td className="py-2 text-right font-mono">{r.filled}</td>
            <td className="py-2 text-right font-mono">{r.total}</td>
            <td className="py-2 text-right font-mono font-semibold">{r.pct.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
