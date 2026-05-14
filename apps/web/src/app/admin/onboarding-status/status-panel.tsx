'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface DataStatus { rows?: Array<{ entity: string; count: number }> }

interface Step { label: string; done: boolean; detail: string; href: string }

export function OnboardingStatus() {
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' });
        const j: DataStatus = r.ok ? await r.json() : {};
        const counts: Record<string, number> = {};
        for (const row of j.rows ?? []) counts[row.entity] = row.count;

        const out: Step[] = [];
        out.push({
          label: '1. Company profile',
          done: true,
          detail: 'YGE company info exists.',
          href: '/admin/company-info',
        });
        out.push({
          label: '2. Customers loaded',
          done: (counts.customers ?? 0) > 0,
          detail: `${counts.customers ?? 0} customers on file`,
          href: '/customers',
        });
        out.push({
          label: '3. Vendors loaded',
          done: (counts.vendors ?? 0) > 0,
          detail: `${counts.vendors ?? 0} vendors on file`,
          href: '/vendors',
        });
        out.push({
          label: '4. Employees loaded',
          done: (counts.employees ?? 0) > 0,
          detail: `${counts.employees ?? 0} employees on file`,
          href: '/employees',
        });
        out.push({
          label: '5. Rate book',
          done: (counts.equipmentRates ?? counts.equipment ?? 0) > 0 || (counts.laborRates ?? 0) > 0,
          detail: `${counts.equipmentRates ?? counts.equipment ?? 0} equipment + ${counts.laborRates ?? 0} labor rates`,
          href: '/equipment-rates',
        });
        out.push({
          label: '6. Cost codes loaded',
          done: (counts.costCodes ?? 0) > 0,
          detail: `${counts.costCodes ?? 0} cost codes on file`,
          href: '/cost-codes',
        });
        out.push({
          label: '7. First job created',
          done: (counts.jobs ?? 0) > 0,
          detail: `${counts.jobs ?? 0} jobs on file`,
          href: '/jobs',
        });
        setSteps(out);
      } catch {
        setSteps([]);
      }
    })();
  }, []);

  if (!steps) return <p className="text-sm text-gray-500">Loading…</p>;
  if (steps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        Could not check onboarding status.
      </p>
    );
  }
  const done = steps.filter((s) => s.done).length;
  const pct = (done / steps.length) * 100;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3 shadow-sm ${pct === 100 ? 'border-green-200 bg-green-50' : pct >= 50 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
        <div className="text-xs text-gray-500">Progress</div>
        <div className="text-2xl font-bold text-gray-900">{done} / {steps.length} steps · {pct.toFixed(0)}%</div>
      </div>
      <ol className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${s.done ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
              {s.done ? 'done' : 'todo'}
            </span>
            <span className="flex-1 text-gray-900">
              {s.label} — <span className="text-xs text-gray-600">{s.detail}</span>
            </span>
            <Link href={s.href} className="text-xs text-yge-blue-700 hover:underline">open</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
