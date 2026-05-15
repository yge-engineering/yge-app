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

interface Section {
  label: string;
  items: Array<{ field: string; missing: number; total: number; href: string }>;
}

export function ChecklistPanel() {
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { customers: [] }).then((j: { customers?: Customer[] }) => j.customers ?? []),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { vendors: [] }).then((j: { vendors?: Vendor[] }) => j.vendors ?? []),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { jobs: [] }).then((j: { jobs?: Job[] }) => j.jobs ?? []),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : { employees: [] }).then((j: { employees?: Employee[] }) => j.employees ?? []),
      ]);
      setSections([
        {
          label: 'Customers',
          items: [
            { field: 'email', missing: c.filter((x) => !x.email).length, total: c.length, href: '/customers/missing-email' },
            { field: 'phone', missing: c.filter((x) => !x.phone).length, total: c.length, href: '/customers/missing-phone' },
            { field: 'billing address', missing: c.filter((x) => !x.billingAddressLine).length, total: c.length, href: '/customers/missing-billing' },
          ],
        },
        {
          label: 'Vendors',
          items: [
            { field: 'state', missing: v.filter((x) => !x.state).length, total: v.length, href: '/vendors/missing-state' },
            { field: 'kind', missing: v.filter((x) => !x.kind).length, total: v.length, href: '/vendors/missing-kind' },
            { field: 'phone', missing: v.filter((x) => !x.phone).length, total: v.length, href: '/vendors/missing-phone' },
          ],
        },
        {
          label: 'Jobs',
          items: [
            { field: 'status', missing: j.filter((x) => !x.status).length, total: j.length, href: '/jobs/missing-status' },
            { field: 'owner agency', missing: j.filter((x) => !x.ownerAgency).length, total: j.length, href: '/jobs/missing-owner' },
            { field: 'job number', missing: j.filter((x) => !x.jobNumber).length, total: j.length, href: '/jobs/missing-number' },
          ],
        },
        {
          label: 'Employees',
          items: [
            { field: 'classification', missing: e.filter((x) => !x.classification).length, total: e.length, href: '/employees/missing-classification' },
            { field: 'rate type', missing: e.filter((x) => !x.rateType).length, total: e.length, href: '/employees/missing-rate-type' },
            { field: 'hire date', missing: e.filter((x) => !x.hireDate).length, total: e.length, href: '/employees/missing-hire-date' },
          ],
        },
      ]);
    }
    load().catch(() => setSections([]));
  }, []);

  if (!sections) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const totalMissing = s.items.reduce((sum, it) => sum + it.missing, 0);
        const totalRecords = s.items[0]?.total ?? 0;
        const pct = totalRecords > 0 ? (1 - totalMissing / (totalRecords * s.items.length)) * 100 : 100;
        return (
          <section key={s.label} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-yge-blue-900">{s.label}</h2>
              <span className="text-[11px] text-gray-500">{pct.toFixed(0)}% complete</span>
            </div>
            <div className="mb-2 h-2 w-full overflow-hidden rounded bg-gray-100">
              <div
                className={pct >= 90 ? 'h-full bg-green-500' : pct >= 70 ? 'h-full bg-amber-500' : 'h-full bg-red-500'}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <ul className="space-y-1">
              {s.items.map((it) => (
                <li key={it.field} className="flex items-center justify-between text-xs">
                  <Link href={it.href} className="text-yge-blue-700 hover:underline">
                    {it.field}
                  </Link>
                  <span className={it.missing === 0 ? 'text-green-700' : 'text-red-700'}>
                    {it.missing} missing / {it.total}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
