'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  costCode: string;
  description: string;
  category: string;
  bidQty: number;
  bidTotalCents: number;
  actualQty: number;
  actualTotalCents: number;
  varianceCents: number;
}

interface Resp {
  jobNumber: string;
  jobName: string;
  rows: Row[];
}

export function CostCodeVarianceTable({ jobId }: { jobId: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(jobId)}/cost-code-variance`, {
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) {
          setError(`Failed (${r.status})`);
          return;
        }
        setData((await r.json()) as Resp);
      })
      .catch((e) => setError((e as Error).message));
  }, [jobId]);

  if (error) return <p className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No bid or actual line items have a cost code for this job. (Imported
        estimates need their cost codes filled in, and daily reports need
        their cost code column populated.)
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Cost code</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2 text-right">Bid qty</th>
            <th className="px-3 py-2 text-right">Bid $</th>
            <th className="px-3 py-2 text-right">Actual qty</th>
            <th className="px-3 py-2 text-right">Actual $</th>
            <th className="px-3 py-2 text-right">Variance</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.costCode} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-[12px]">{r.costCode}</td>
              <td className="px-3 py-2">{r.description}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{r.category}</td>
              <td className="px-3 py-2 text-right font-mono">{r.bidQty || ''}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.bidTotalCents ? <Money cents={r.bidTotalCents} /> : ''}
              </td>
              <td className="px-3 py-2 text-right font-mono">{r.actualQty || ''}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.actualTotalCents ? <Money cents={r.actualTotalCents} /> : ''}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono ${
                  r.varianceCents < 0 ? 'text-red-700 font-semibold' : 'text-gray-700'
                }`}
              >
                <Money cents={r.varianceCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
