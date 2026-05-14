// Budget vs Actual tile — replicates the Excel "Job Cost Tracker" sheet
// inside the app. Pulls budgets from Job.data (imported) and actuals
// from DailyReport lines.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CategoryRow {
  key: 'LABOR' | 'MATERIALS' | 'EQUIPMENT' | 'SUBS' | 'OTHER';
  budget: number;
  actual: number;
  variance: number;
  pctUsed: number;
}

interface Resp {
  jobNumber: string;
  jobName: string;
  categories: CategoryRow[];
  total: { budget: number; actual: number; pctUsed: number };
  status: 'On Track' | 'Watch' | 'Over';
}

const LABELS: Record<CategoryRow['key'], string> = {
  LABOR: 'Labor',
  MATERIALS: 'Materials',
  EQUIPMENT: 'Equipment',
  SUBS: 'Subcontract',
  OTHER: 'Other',
};

const STATUS_STYLES = {
  'On Track': 'bg-green-50 text-green-800 border-green-300',
  Watch: 'bg-amber-50 text-amber-800 border-amber-300',
  Over: 'bg-red-50 text-red-800 border-red-300',
} as const;

export function JobBudgetActualTile({ jobId }: { jobId: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(jobId)}/budget-actual`, {
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

  if (error) {
    return (
      <p className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-gray-500">Loading budget vs actual…</p>;
  if (data.total.budget === 0) {
    return (
      <p className="text-sm text-gray-500">
        No budget set on this job. (Imported jobs get budgets from the Excel
        Jobs sheet — re-run the people/jobs import if you've updated budgets there.)
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-900">Budget vs Actual</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[data.status]}`}
        >
          {data.status} · {Math.round(data.total.pctUsed * 100)}% used
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">Budget</th>
            <th className="px-4 py-2 text-right">Actual</th>
            <th className="px-4 py-2 text-right">Variance</th>
            <th className="px-4 py-2 text-right">% Used</th>
          </tr>
        </thead>
        <tbody>
          {data.categories.map((c) => {
            const isOver = c.pctUsed > 1;
            const isWatch = !isOver && c.pctUsed > 0.85;
            return (
              <tr key={c.key} className="border-t border-gray-100">
                <td className="px-4 py-2">{LABELS[c.key]}</td>
                <td className="px-4 py-2 text-right font-mono"><Money cents={c.budget} /></td>
                <td className="px-4 py-2 text-right font-mono"><Money cents={c.actual} /></td>
                <td
                  className={`px-4 py-2 text-right font-mono ${c.variance < 0 ? 'text-red-700' : 'text-gray-700'}`}
                >
                  <Money cents={c.variance} />
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${isOver ? 'text-red-700 font-semibold' : isWatch ? 'text-amber-700' : 'text-gray-700'}`}
                >
                  {Math.round(c.pctUsed * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right font-mono"><Money cents={data.total.budget} /></td>
            <td className="px-4 py-2 text-right font-mono"><Money cents={data.total.actual} /></td>
            <td className="px-4 py-2 text-right font-mono">
              <Money cents={data.total.budget - data.total.actual} />
            </td>
            <td className="px-4 py-2 text-right font-mono">
              {Math.round(data.total.pctUsed * 100)}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
