'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Resp {
  counts: {
    customers: number; vendors: number; jobs: number;
    importedEstimates: number; costCodes: number; materials: number;
    bidResults: number; dailyReports: number;
  };
  jobsByStatus: Record<string, number>;
  bids: { total: number; won: number; lost: number; winRate: number };
}

export function DashboardSummaryTile() {
  const [data, setData] = useState<Resp | null>(null);
  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/dashboard/summary`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);
  if (!data) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Master data snapshot
        </h2>
        <Link href="/admin/data-status" className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-500 hover:bg-yge-blue-50">
          Detail →
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Tile label="Customers" value={data.counts.customers} href="/customers" />
        <Tile label="Vendors" value={data.counts.vendors} href="/vendors" />
        <Tile label="Jobs" value={data.counts.jobs} href="/jobs" />
        <Tile label="Estimates" value={data.counts.importedEstimates} href="/imported-estimates" />
        <Tile label="Cost codes" value={data.counts.costCodes} href="/cost-codes" />
        <Tile label="Materials" value={data.counts.materials} href="/materials" />
        <Tile label="Bid results" value={data.counts.bidResults} href="/bid-results" />
        <Tile label="Daily reports" value={data.counts.dailyReports} href="/daily-reports" />
      </div>
    </section>
  );
}

function Tile({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block rounded border border-gray-200 bg-gray-50 p-2 hover:bg-yge-blue-50">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-bold text-yge-blue-900">{value}</div>
    </Link>
  );
}
