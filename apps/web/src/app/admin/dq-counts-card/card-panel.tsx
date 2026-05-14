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

export function DqCountsCard() {
  const [count, setCount] = useState<number | null>(null);

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

        let total = 0;
        total += customers.filter((c) => !(c.email ?? '').includes('@')).length;
        total += customers.filter((c) => !(c.phone ?? '').trim()).length;
        total += customers.filter((c) => !(c.state ?? '').trim()).length;
        total += vendors.filter((v) => !((v.email ?? v.data?.email) ?? '').includes('@')).length;
        total += vendors.filter((v) => !(((v.phone ?? v.data?.phone) ?? '').trim())).length;
        total += vendors.filter((v) => !(((v.state ?? v.data?.state) ?? '').trim())).length;
        total += jobs.filter((j) => !((j.ownerAgency ?? '').trim())).length;
        total += jobs.filter((j) => !((j.jobNumber ?? '').trim())).length;
        total += jobs.filter((j) => !((j.status ?? '').trim())).length;
        total += jobs.filter((j) => !((j.rateType ?? '').trim())).length;
        total += emps.filter((e) => !((e.classification ?? '').trim())).length;
        total += emps.filter((e) => !((e.hireDate ?? '').trim())).length;

        setCount(total);
      } catch {
        setCount(0);
      }
    })();
  }, []);

  if (count === null) return <p className="text-sm text-gray-500">Loading…</p>;
  const tone = count === 0 ? 'text-green-700' : count < 25 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Missing-field cells across master data</div>
      <div className={`mt-2 text-6xl font-bold ${tone}`}>{count}</div>
      <p className="mt-3 text-xs text-gray-500">
        Drill in at{' '}
        <Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">/admin/data-quality-counts</Link>
        {' · '}
        <Link href="/admin/cleanup-progress" className="text-yge-blue-700 hover:underline">/admin/cleanup-progress</Link>.
      </p>
    </div>
  );
}
