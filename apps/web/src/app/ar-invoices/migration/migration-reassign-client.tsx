'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  totalCents: number;
}

interface JobOption {
  id: string;
  projectName: string;
}

export function MigrationReassignClient({
  apiBaseUrl,
  invoices,
  jobs,
}: {
  apiBaseUrl: string;
  invoices: InvoiceRow[];
  jobs: JobOption[];
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function move(invoiceId: string) {
    const jobId = picks[invoiceId];
    if (!jobId) {
      setError('Pick a job first.');
      return;
    }
    setBusyId(invoiceId);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ar-invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setDoneIds((d) => ({ ...d, [invoiceId]: true }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      {error && <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Open</th>
            <th className="px-3 py-2">Move to job</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.map((inv) => {
            const done = doneIds[inv.id];
            return (
              <tr key={inv.id} className={done ? 'opacity-50' : ''}>
                <td className="px-3 py-2">{inv.customerName}</td>
                <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="px-3 py-2 font-mono text-xs">{inv.invoiceDate}</td>
                <td className="px-3 py-2 text-right font-mono">{usd(inv.totalCents)}</td>
                <td className="px-3 py-2">
                  <select
                    value={picks[inv.id] ?? ''}
                    disabled={done || busyId === inv.id}
                    onChange={(e) => setPicks((p) => ({ ...p, [inv.id]: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">Select a job…</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.projectName}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  {done ? (
                    <span className="text-xs font-semibold text-green-700">Moved ✓</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === inv.id || !picks[inv.id]}
                      onClick={() => void move(inv.id)}
                      className="rounded bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-40"
                    >
                      {busyId === inv.id ? 'Moving…' : 'Move'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
