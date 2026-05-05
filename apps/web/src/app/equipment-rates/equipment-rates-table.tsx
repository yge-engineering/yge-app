'use client';

import { useMemo, useState } from 'react';
import type { EquipmentRate, EquipmentRateKind } from '@yge/shared';

function fmtMoney(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export function EquipmentRatesTable({ rates }: { rates: EquipmentRate[] }) {
  const [kind, setKind] = useState<EquipmentRateKind | ''>('');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return rates.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (!norm) return true;
      return (
        r.costCode.toLowerCase().includes(norm) ||
        r.name.toLowerCase().includes(norm) ||
        (r.category ?? '').toLowerCase().includes(norm)
      );
    });
  }, [rates, q, kind]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-gray-300 bg-white">
          {(['', 'OWNED', 'RENTAL'] as const).map((k) => (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => setKind(k as EquipmentRateKind | '')}
              className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md last:rounded-r-md ${kind === k ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {k === '' ? 'All' : k === 'OWNED' ? 'Owned' : 'Rental'}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code, name, or category…"
          className="w-72 max-w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-gray-500">
          {filtered.length} of {rates.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Daily</th>
              <th className="px-3 py-2 text-right">Weekly</th>
              <th className="px-3 py-2 text-right">Monthly</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">
                  No rates match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.costCode}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${r.kind === 'OWNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.kind === 'OWNED' ? 'Owned' : 'Rental'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'OWNED'
                      ? `${fmtMoney(r.totalCentsPerHour)} / hr`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.dailyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.weeklyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.kind === 'RENTAL' ? fmtMoney(r.monthlyCents) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.notes ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
