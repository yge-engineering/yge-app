// Imported daily reports panel — shows the rows from the Excel
// "Daily Report" sheet, grouped by date. Each card expands to show
// the line items.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Line {
  date: string;
  jobNumber: string;
  jobName: string | null;
  category: string | null;
  costCode: string | null;
  description: string | null;
  qtyHrs: number | null;
  unit: string | null;
  otMult: number | null;
  rateCents: number | null;
  totalCostCents: number | null;
  employeeVendor: string | null;
  notes: string | null;
}

interface Report {
  id: string;
  jobId: string;
  reportDate: string;
  data: { lines?: Line[]; importedFromExcel?: boolean };
}

export function ImportedDailyReportsPanel({ jobId }: { jobId: string }) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(
      `${apiBaseUrl()}/api/imported-daily-reports?jobId=${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    )
      .then(async (r) => (r.ok ? ((await r.json()) as { reports: Report[] }) : { reports: [] }))
      .then((j) => setReports(j.reports));
  }, [jobId]);

  if (reports === null) {
    return <p className="mt-2 text-sm text-gray-500">Loading…</p>;
  }
  if (reports.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No imported daily reports for this job.</p>;
  }

  function toggle(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  }

  return (
    <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
      {reports.map((r) => {
        const lines = r.data.lines ?? [];
        const totalCents = lines.reduce(
          (sum, l) => sum + (l.totalCostCents ?? 0),
          0,
        );
        const isOpen = open.has(r.id);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => toggle(r.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{r.reportDate}</div>
                <div className="text-xs text-gray-500">
                  {lines.length} line{lines.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Money cents={totalCents} />
                <span className="text-xs text-gray-400">
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>
            </button>
            {isOpen ? (
              <div className="overflow-x-auto border-t border-gray-100 bg-gray-50 px-4 py-2">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">Category</th>
                      <th className="py-1">Cost Code</th>
                      <th className="py-1">Description</th>
                      <th className="py-1 text-right">Qty</th>
                      <th className="py-1">Unit</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Total</th>
                      <th className="py-1">Who</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1">{l.category ?? ''}</td>
                        <td className="py-1 font-mono text-[11px]">{l.costCode ?? ''}</td>
                        <td className="py-1">{l.description ?? ''}</td>
                        <td className="py-1 text-right">{l.qtyHrs ?? ''}</td>
                        <td className="py-1">{l.unit ?? ''}</td>
                        <td className="py-1 text-right">
                          {l.rateCents ? <Money cents={l.rateCents} /> : ''}
                        </td>
                        <td className="py-1 text-right">
                          {l.totalCostCents ? <Money cents={l.totalCostCents} /> : ''}
                        </td>
                        <td className="py-1">{l.employeeVendor ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
