'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string; code: string; name: string; unit: string;
  unitCostCents: number; updatedAt: string;
  ageDays: number; severity: 'fresh' | 'stale' | 'very_stale';
}

interface Resp {
  rows: Row[]; fresh: number; stale: number; veryStale: number;
}

const TONE: Record<Row['severity'], string> = {
  fresh: 'bg-green-100 text-green-800 border-green-300',
  stale: 'bg-amber-100 text-amber-800 border-amber-300',
  very_stale: 'bg-red-100 text-red-800 border-red-300',
};

export function StalenessTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/materials/staleness`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label="Fresh ≤180d" value={data.fresh} tone="bg-green-50 text-green-800" />
        <Tile label="Stale 180-365d" value={data.stale} tone="bg-amber-50 text-amber-800" />
        <Tile label="Very stale >365d" value={data.veryStale} tone="bg-red-50 text-red-800" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-right">Age (days)</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[r.severity]}`}>
                    {r.severity}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[12px]">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-xs">{r.unit}</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={r.unitCostCents} /></td>
                <td className="px-3 py-2 text-right font-mono">{r.ageDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
