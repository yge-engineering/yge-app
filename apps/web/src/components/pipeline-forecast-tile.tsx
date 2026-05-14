// pipeline forecast tile — last updated 1722 (added overnight-batch marker).
// Dashboard tile: risk-adjusted pipeline forecast (S1').

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

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

export function PipelineForecastTile() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/pipeline-forecast`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Pipeline forecast
      </h2>
      {data === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.openCount === 0 ? (
        <p className="text-sm text-gray-500">
          No open pursuits with bid prices yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Open bids" value={data.openCount} />
            <Tile label="Exposed" value={<Money cents={data.exposedCents} />} />
            <Tile
              label="Risk-adjusted"
              value={<Money cents={data.riskAdjustedCents} />}
              tone="good"
            />
            <Tile
              label="Avg win rate"
              value={
                data.exposedCents > 0
                  ? `${Math.round((data.riskAdjustedCents / data.exposedCents) * 100)}%`
                  : '—'
              }
            />
          </div>
          {data.byAgency.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 text-xs">
              {data.byAgency.slice(0, 5).map((a) => (
                <li key={a.agency} className="flex items-center justify-between py-1.5">
                  <span className="truncate text-gray-700">{a.agency}</span>
                  <span className="font-mono text-yge-blue-900">
                    <Money cents={a.riskAdjustedCents} />
                    <span className="ml-1 text-[10px] text-gray-500">
                      ({Math.round(a.winRate * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'good';
}) {
  const toneStyle = tone === 'good' ? 'text-green-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`text-xl font-bold ${toneStyle}`}>{value}</div>
    </div>
  );
}
