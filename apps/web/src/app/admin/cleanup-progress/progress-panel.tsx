'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; state?: string | null; billingAddressLine?: string | null }
interface Vendor { id: string; email?: string; phone?: string; state?: string | null; billingAddressLine?: string | null; data?: { email?: string; phone?: string; state?: string | null; billingAddressLine?: string | null } }
interface Job { id: string; ownerAgency?: string | null; jobNumber?: string | null; location?: string | null; status?: string | null; rateType?: string | null }
interface Employee { id: string; classification?: string | null; hireDate?: string | null }

interface Row { label: string; have: number; total: number; href: string }

function pct(have: number, total: number): number { return total > 0 ? (have / total) * 100 : 0; }

export function ProgressPanel() {
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

        const out: Row[] = [];
        out.push({ label: 'Customers — email', have: customers.filter((c) => (c.email ?? '').includes('@')).length, total: customers.length, href: '/customers/with-email' });
        out.push({ label: 'Customers — phone', have: customers.filter((c) => (c.phone ?? '').trim()).length, total: customers.length, href: '/customers/with-phone' });
        out.push({ label: 'Customers — state', have: customers.filter((c) => (c.state ?? '').trim()).length, total: customers.length, href: '/customers/with-state' });
        out.push({ label: 'Customers — billing addr', have: customers.filter((c) => (c.billingAddressLine ?? '').trim()).length, total: customers.length, href: '/customers/with-billing-address' });
        out.push({ label: 'Vendors — email', have: vendors.filter((v) => ((v.email ?? v.data?.email) ?? '').includes('@')).length, total: vendors.length, href: '/vendors/with-email' });
        out.push({ label: 'Vendors — phone', have: vendors.filter((v) => ((v.phone ?? v.data?.phone) ?? '').trim()).length, total: vendors.length, href: '/vendors/with-phone' });
        out.push({ label: 'Vendors — state', have: vendors.filter((v) => ((v.state ?? v.data?.state) ?? '').trim()).length, total: vendors.length, href: '/vendors/with-state' });
        out.push({ label: 'Vendors — billing addr', have: vendors.filter((v) => ((v.billingAddressLine ?? v.data?.billingAddressLine) ?? '').trim()).length, total: vendors.length, href: '/vendors/with-billing-address' });
        out.push({ label: 'Jobs — owner agency', have: jobs.filter((j) => (j.ownerAgency ?? '').trim()).length, total: jobs.length, href: '/jobs/with-owner-agency' });
        out.push({ label: 'Jobs — job number', have: jobs.filter((j) => (j.jobNumber ?? '').trim()).length, total: jobs.length, href: '/jobs/with-job-number' });
        out.push({ label: 'Jobs — location', have: jobs.filter((j) => (j.location ?? '').trim()).length, total: jobs.length, href: '/jobs/with-location' });
        out.push({ label: 'Jobs — status', have: jobs.filter((j) => (j.status ?? '').trim()).length, total: jobs.length, href: '/jobs/with-status' });
        out.push({ label: 'Jobs — rate type', have: jobs.filter((j) => (j.rateType ?? '').trim()).length, total: jobs.length, href: '/jobs/with-rate-type' });
        out.push({ label: 'Employees — classification', have: emps.filter((e) => (e.classification ?? '').trim()).length, total: emps.length, href: '/employees/with-classification' });
        out.push({ label: 'Employees — hire date', have: emps.filter((e) => (e.hireDate ?? '').trim()).length, total: emps.length, href: '/employees/with-hire-date' });

        setRows(out);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2 text-right">Has</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = pct(r.have, r.total);
            const tone = p >= 90 ? 'text-green-700' : p >= 60 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={r.label} className="border-t border-gray-100">
                <td className="px-3 py-2"><Link href={r.href} className="text-yge-blue-700 hover:underline">{r.label}</Link></td>
                <td className="px-3 py-2 text-right font-mono">{r.have}</td>
                <td className="px-3 py-2 text-right font-mono">{r.total}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>{r.total > 0 ? `${p.toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
