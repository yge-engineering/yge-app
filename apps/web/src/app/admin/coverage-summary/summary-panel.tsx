'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; state?: string | null }
interface Vendor { id: string; email?: string; phone?: string; state?: string | null; data?: { email?: string; phone?: string; state?: string | null } }
interface Job { id: string; ownerAgency?: string | null; jobNumber?: string | null; status?: string | null; rateType?: string | null }
interface Employee { id: string; classification?: string | null; hireDate?: string | null }

interface Row { entity: string; pct: number; href: string }

export function CoverageSummary() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cr, vr, jr, er] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        const customers: Customer[] = cr?.customers ?? [];
        const vendors: Vendor[] = vr?.vendors ?? [];
        const jobs: Job[] = jr?.jobs ?? [];
        const emps: Employee[] = er?.employees ?? [];

        function avgPct(samples: number[]): number {
          if (samples.length === 0) return 0;
          return samples.reduce((a, b) => a + b, 0) / samples.length;
        }
        function pctOf(have: number, total: number) { return total > 0 ? (have / total) * 100 : 0; }

        const out: Row[] = [];
        out.push({
          entity: 'Customers',
          pct: avgPct([
            pctOf(customers.filter((c) => (c.email ?? '').includes('@')).length, customers.length),
            pctOf(customers.filter((c) => (c.phone ?? '').trim()).length, customers.length),
            pctOf(customers.filter((c) => (c.state ?? '').trim()).length, customers.length),
          ]),
          href: '/admin/cleanup-progress',
        });
        out.push({
          entity: 'Vendors',
          pct: avgPct([
            pctOf(vendors.filter((v) => ((v.email ?? v.data?.email) ?? '').includes('@')).length, vendors.length),
            pctOf(vendors.filter((v) => ((v.phone ?? v.data?.phone) ?? '').trim()).length, vendors.length),
            pctOf(vendors.filter((v) => ((v.state ?? v.data?.state) ?? '').trim()).length, vendors.length),
          ]),
          href: '/admin/cleanup-progress',
        });
        out.push({
          entity: 'Jobs',
          pct: avgPct([
            pctOf(jobs.filter((j) => (j.ownerAgency ?? '').trim()).length, jobs.length),
            pctOf(jobs.filter((j) => (j.jobNumber ?? '').trim()).length, jobs.length),
            pctOf(jobs.filter((j) => (j.status ?? '').trim()).length, jobs.length),
            pctOf(jobs.filter((j) => (j.rateType ?? '').trim()).length, jobs.length),
          ]),
          href: '/admin/cleanup-progress',
        });
        out.push({
          entity: 'Employees',
          pct: avgPct([
            pctOf(emps.filter((e) => (e.classification ?? '').trim()).length, emps.length),
            pctOf(emps.filter((e) => (e.hireDate ?? '').trim()).length, emps.length),
          ]),
          href: '/admin/cleanup-progress',
        });
        setRows(out);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const tone = r.pct >= 90 ? 'bg-green-500' : r.pct >= 70 ? 'bg-emerald-500' : r.pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
        return (
          <Link key={r.entity} href={r.href} className="block rounded border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-gray-900">{r.entity}</span>
              <span className="font-mono text-sm">{r.pct.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-gray-200">
              <div className={`h-full rounded ${tone}`} style={{ width: `${Math.min(100, Math.max(0, r.pct))}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
