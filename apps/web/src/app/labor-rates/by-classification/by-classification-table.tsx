'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Rate { id: string; classification?: string | null; hourlyCents?: number | null }

interface Resp { laborRates?: Rate[] }

interface Stat { classification: string; count: number; min: number; avg: number; max: number }

function buildStats(rates: Rate[]): Stat[] {
  const map = new Map<string, { count: number; sum: number; min: number; max: number }>();
  for (const r of rates) {
    const k = (r.classification ?? '').trim().toUpperCase() || '(unknown)';
    let s = map.get(k);
    if (!s) {
      s = { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 };
      map.set(k, s);
    }
    s.count += 1;
    const cents = r.hourlyCents ?? 0;
    if (cents > 0) {
      s.sum += cents;
      if (cents < s.min) s.min = cents;
      if (cents > s.max) s.max = cents;
    }
  }
  return [...map.entries()].map(([classification, s]) => ({
    classification,
    count: s.count,
    min: Number.isFinite(s.min) ? s.min : 0,
    avg: s.count > 0 ? Math.round(s.sum / s.count) : 0,
    max: s.max,
  })).sort((a, b) => b.count - a.count);
}

export function ByClassificationTable() {
  const [rates, setRates] = useState<Rate[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/labor-rates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setRates(j?.laborRates ?? []));
  }, []);

  if (!rates) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No labor rate records yet.
      </p>
    );
  }

  const stats = buildStats(rates);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Classification</th>
            <th className="px-3 py-2 text-right">Records</th>
            <th className="px-3 py-2 text-right">Min hourly</th>
            <th className="px-3 py-2 text-right">Avg hourly</th>
            <th className="px-3 py-2 text-right">Max hourly</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.classification} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{s.classification}</td>
              <td className="px-3 py-2 text-right font-mono">{s.count}</td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={s.min} /></td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={s.avg} /></td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={s.max} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
