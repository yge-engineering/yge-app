// Last-bid history — small inline summary of recent bid prices for a
// given cost code, fed by /api/cost-codes/:code/history.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  estimateId: string;
  jobNumber: string;
  projectName: string;
  createdAt: string;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  bidPriceCents: number;
  description: string;
}

export function LastBidHistory({ code }: { code: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setRows(null);
      return;
    }
    setRows(null);
    setError(null);
    fetch(`${apiBaseUrl()}/api/cost-codes/${encodeURIComponent(code)}/history?limit=5`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
      .then((j: { rows?: Row[] }) => setRows(j.rows ?? []))
      .catch((e: Error) => setError(e.message));
  }, [code]);

  if (!code) return null;
  if (error) {
    return <p className="text-[10px] text-red-700">history error: {error}</p>;
  }
  if (rows === null) {
    return <p className="text-[10px] text-gray-500">loading recent bids…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-[10px] text-gray-500">no prior bids for {code}</p>;
  }

  return (
    <div className="mt-1 rounded border border-gray-200 bg-gray-50 p-2 text-[10px]">
      <div className="mb-1 font-semibold text-gray-700">
        Recent bids on {code}
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-0.5">Job</th>
            <th className="py-0.5 text-right">Qty</th>
            <th className="py-0.5 text-right">Unit</th>
            <th className="py-0.5 text-right">Bid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.estimateId} className="border-t border-gray-200">
              <td className="py-0.5 truncate">{r.jobNumber}</td>
              <td className="py-0.5 text-right font-mono">{r.quantity || ''}</td>
              <td className="py-0.5 text-right font-mono">
                {r.unitCostCents ? <Money cents={r.unitCostCents} /> : ''}
              </td>
              <td className="py-0.5 text-right font-mono">
                {r.bidPriceCents ? <Money cents={r.bidPriceCents} /> : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
