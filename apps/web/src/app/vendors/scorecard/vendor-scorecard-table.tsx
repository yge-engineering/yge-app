'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  legalName: string;
  dbaName: string | null;
  jobsAwarded: number;
  totalPaidCents: number;
  totalUnpaidCents: number;
  avgDaysToPay: number | null;
  lastInvoiceAt: string | null;
}

export function VendorScorecardTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/vendors/scorecard?kind=SUBCONTRACTOR`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: Row[] }) => setRows(j.rows ?? []));
  }, []);

  if (rows === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No subcontractor activity yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Sub</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">Paid</th>
            <th className="px-3 py-2 text-right">Open</th>
            <th className="px-3 py-2 text-right">Avg pay days</th>
            <th className="px-3 py-2">Last invoice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const slowPay = (r.avgDaysToPay ?? 0) > 60;
            return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div className="text-sm font-medium">{r.dbaName ?? r.legalName}</div>
                  {r.dbaName && r.dbaName !== r.legalName && (
                    <div className="text-xs text-gray-500">{r.legalName}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.jobsAwarded}</td>
                <td className="px-3 py-2 text-right font-mono">
                  <Money cents={r.totalPaidCents} />
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    r.totalUnpaidCents > 0 ? 'text-amber-700' : 'text-gray-700'
                  }`}
                >
                  <Money cents={r.totalUnpaidCents} />
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${slowPay ? 'text-red-700 font-semibold' : 'text-gray-700'}`}
                >
                  {r.avgDaysToPay === null ? '—' : r.avgDaysToPay.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.lastInvoiceAt ? r.lastInvoiceAt.slice(0, 10) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
