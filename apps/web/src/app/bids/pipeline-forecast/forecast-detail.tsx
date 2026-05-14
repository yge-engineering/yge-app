'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface AgencyForecast {
  agency: string;
  openCount: number;
  exposedCents: number;
  riskAdjustedCents: number;
  winRate: number;
}

interface Resp {
  openCount: number;
  exposedCents: number;
  riskAdjustedCents: number;
  byAgency: AgencyForecast[];
}

export function ForecastDetail() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/pipeline-forecast`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.openCount === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No open pursuits with bid prices yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label="Open bids" value={data.openCount} />
        <Tile label="Exposed" value={<Money cents={data.exposedCents} />} />
        <Tile label="Risk-adjusted" value={<Money cents={data.riskAdjustedCents} />} tone="good" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Agency</th>
              <th className="px-3 py-2 text-right">Open bids</th>
              <th className="px-3 py-2 text-right">Exposed</th>
              <th className="px-3 py-2 text-right">Win rate</th>
              <th className="px-3 py-2 text-right">Risk-adj $</th>
            </tr>
          </thead>
          <tbody>
            {data.byAgency.map((a) => (
              <tr key={a.agency} className="border-t border-gray-100">
                <td className="px-3 py-2">{a.agency}</td>
                <td className="px-3 py-2 text-right">{a.openCount}</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={a.exposedCents} /></td>
                <td className="px-3 py-2 text-right font-mono">{(a.winRate * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right font-mono text-green-700"><Money cents={a.riskAdjustedCents} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Win rate uses each agency's historical win/(won+lost) ratio. Agencies with &lt;2 prior bids default to 30% baseline.
      </p>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'good' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : 'text-yge-blue-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
