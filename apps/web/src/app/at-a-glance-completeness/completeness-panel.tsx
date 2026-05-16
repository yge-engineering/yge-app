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

function pctOf(filled: number, total: number): number {
  return total === 0 ? 100 : (filled / total) * 100;
}

export function CompletenessPanel() {
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

      const cTally = tally(c, [(x) => x.email, (x) => x.phone, (x) => x.billingAddressLine]);
      const vTally = tally(v, [(x) => x.state, (x) => x.kind, (x) => x.phone]);
      const jTally = tally(j, [(x) => x.status, (x) => x.ownerAgency, (x) => x.jobNumber]);
      const eTally = tally(e, [(x) => x.classification, (x) => x.rateType, (x) => x.hireDate]);

      setRows([
        { label: 'Customers', pct: pctOf(cTally.filled, cTally.total), ...cTally },
        { label: 'Vendors', pct: pctOf(vTally.filled, vTally.total), ...vTally },
        { label: 'Jobs', pct: pctOf(jTally.filled, jTally.total), ...jTally },
        { label: 'Employees', pct: pctOf(eTally.filled, eTally.total), ...eTally },
      ]);
    }
    load().catch(() => setRows([]));
  }, []);

  if (!rows) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-yge-blue-900">{r.label}</span>
            <span className="font-mono text-xs text-gray-500">
              {r.filled}/{r.total} fields · <strong>{r.pct.toFixed(0)}%</strong>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded bg-gray-100">
            <div
              className={r.pct >= 90 ? 'h-full bg-green-500' : r.pct >= 70 ? 'h-full bg-amber-500' : 'h-full bg-red-500'}
              style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
