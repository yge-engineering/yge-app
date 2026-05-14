// Dashboard tile: counts of imported estimates / daily reports / cost
// codes, with quick links to the import workflow.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Counts {
  estimates: number;
  costCodes: number;
  customers: number;
}

export function ExcelImportStatusTile() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [iRes, cRes, custRes] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/imported-estimates`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }),
        ]);
        const iBody = iRes.ok ? ((await iRes.json()) as { importedEstimates?: unknown[] }) : { importedEstimates: [] };
        const cBody = cRes.ok ? ((await cRes.json()) as { costCodes?: unknown[] }) : { costCodes: [] };
        const custBody = custRes.ok ? ((await custRes.json()) as { customers?: unknown[] }) : { customers: [] };
        setCounts({
          estimates: (iBody.importedEstimates ?? []).length,
          costCodes: (cBody.costCodes ?? []).length,
          customers: (custBody.customers ?? []).length,
        });
      } catch {
        setCounts({ estimates: 0, costCodes: 0, customers: 0 });
      }
    }
    void load();
  }, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Excel imports
        </h2>
        <Link
          href="/admin/excel-import"
          className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          Import &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Estimates" value={counts?.estimates} href="/imported-estimates" />
        <Stat label="Cost codes" value={counts?.costCodes} href="/cost-codes" />
        <Stat label="Customers" value={counts?.customers} href="/customers" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/imported-estimates/compare"
          className="rounded border border-yge-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-yge-blue-700 hover:bg-yge-blue-50"
        >
          Compare two bids
        </Link>
        <Link
          href="/cost-codes"
          className="rounded border border-yge-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-yge-blue-700 hover:bg-yge-blue-50"
        >
          Manage rates
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, href }: { label: string; value: number | undefined; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded border border-gray-200 bg-gray-50 p-2 hover:bg-yge-blue-50 hover:border-yge-blue-300"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-xl font-bold text-yge-blue-900">
        {value === undefined ? '—' : value}
      </div>
    </Link>
  );
}
