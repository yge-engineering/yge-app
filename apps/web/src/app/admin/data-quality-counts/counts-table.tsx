'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; state?: string | null; billingAddressLine?: string | null; onHold?: boolean }
interface Vendor { id: string; email?: string; phone?: string; state?: string | null; billingAddressLine?: string | null; data?: { email?: string; phone?: string; state?: string | null; billingAddressLine?: string | null } }
interface Job { id: string; ownerAgency?: string | null; jobNumber?: string | null; location?: string | null; status?: string | null; rateType?: string | null }
interface Employee { id: string; classification?: string | null; hireDate?: string | null }

interface Row { label: string; count: number; href: string }

export function CountsTable() {
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

        const r: Row[] = [];
        r.push({ label: 'Customers missing email', count: customers.filter((c) => !((c.email ?? '').includes('@'))).length, href: '/customers/missing-email' });
        r.push({ label: 'Customers missing phone', count: customers.filter((c) => !((c.phone ?? '').trim())).length, href: '/customers/missing-phone' });
        r.push({ label: 'Customers missing state', count: customers.filter((c) => !((c.state ?? '').trim())).length, href: '/customers/missing-state' });
        r.push({ label: 'Customers missing billing address', count: customers.filter((c) => !((c.billingAddressLine ?? '').trim())).length, href: '/customers/missing-billing-address' });
        r.push({ label: 'Customers on hold', count: customers.filter((c) => c.onHold === true).length, href: '/customers/on-hold' });
        r.push({ label: 'Vendors missing email', count: vendors.filter((v) => !(((v.email ?? v.data?.email) ?? '').includes('@'))).length, href: '/vendors/missing-email' });
        r.push({ label: 'Vendors missing phone', count: vendors.filter((v) => !(((v.phone ?? v.data?.phone) ?? '').trim())).length, href: '/vendors/missing-phone' });
        r.push({ label: 'Vendors missing state', count: vendors.filter((v) => !(((v.state ?? v.data?.state) ?? '').trim())).length, href: '/vendors/missing-state' });
        r.push({ label: 'Vendors missing billing address', count: vendors.filter((v) => !(((v.billingAddressLine ?? v.data?.billingAddressLine) ?? '').trim())).length, href: '/vendors/missing-billing-address' });
        r.push({ label: 'Jobs missing owner agency', count: jobs.filter((j) => !((j.ownerAgency ?? '').trim())).length, href: '/jobs/missing-owner-agency' });
        r.push({ label: 'Jobs missing job number', count: jobs.filter((j) => !((j.jobNumber ?? '').trim())).length, href: '/jobs/missing-job-number' });
        r.push({ label: 'Jobs missing location', count: jobs.filter((j) => !((j.location ?? '').trim())).length, href: '/jobs/missing-location' });
        r.push({ label: 'Jobs missing status', count: jobs.filter((j) => !((j.status ?? '').trim())).length, href: '/jobs/missing-status' });
        r.push({ label: 'Jobs missing rate type', count: jobs.filter((j) => !((j.rateType ?? '').trim())).length, href: '/jobs/missing-rate-type' });
        r.push({ label: 'Employees missing classification', count: emps.filter((e) => !((e.classification ?? '').trim())).length, href: '/employees/missing-classification' });
        r.push({ label: 'Employees missing hire date', count: emps.filter((e) => !((e.hireDate ?? '').trim())).length, href: '/employees/missing-hire-date' });

        setRows(r);
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
            <th className="px-3 py-2">Bucket</th>
            <th className="px-3 py-2 text-right">Count</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = r.count === 0 ? 'text-green-700' : r.count < 5 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={r.label} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.label}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>{r.count}</td>
                <td className="px-3 py-2"><Link href={r.href} className="text-yge-blue-700 hover:underline">Open</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
