'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row { entity: string; count: number }

export function OnboardingPercent() {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: Row[] } | null) => {
        const counts: Record<string, number> = {};
        for (const r of j?.rows ?? []) counts[r.entity] = r.count;
        const checks = [
          true,                                              // company profile assumed done
          (counts.customers ?? 0) > 0,
          (counts.vendors ?? 0) > 0,
          (counts.employees ?? 0) > 0,
          (counts.equipmentRates ?? counts.equipment ?? 0) > 0 || (counts.laborRates ?? 0) > 0,
          (counts.costCodes ?? 0) > 0,
          (counts.jobs ?? 0) > 0,
        ];
        const done = checks.filter(Boolean).length;
        setPct(checks.length > 0 ? (done / checks.length) * 100 : 0);
      });
  }, []);

  if (pct === null) return <p className="text-sm text-gray-500">Loading…</p>;

  const tone = pct === 100 ? 'bg-green-100 text-green-800' : pct >= 80 ? 'bg-emerald-100 text-emerald-800' : pct >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className={`mx-auto inline-block rounded-full px-6 py-3 text-5xl font-bold ${tone}`}>
          {pct.toFixed(0)}%
        </div>
        <p className="mt-3 text-center text-sm text-gray-600">of the 7 setup-wizard steps satisfied.</p>
      </div>
      <p className="text-xs text-gray-500">
        Detailed breakdown at <Link href="/admin/onboarding-status" className="text-yge-blue-700 hover:underline">/admin/onboarding-status</Link>.
      </p>
    </div>
  );
}
