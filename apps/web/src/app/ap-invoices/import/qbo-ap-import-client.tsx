'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

interface PlanBill {
  sourceVendor: string;
  vendorName: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  totalCents: number;
}

interface ImportSummary {
  parsedRows: number;
  mapped: number;
  willCreate: number;
  willSkip: number;
  warnings: number;
  totalOpenCents: number;
  created?: number;
}

interface DryRunResponse {
  dryRun: true;
  summary: ImportSummary;
  plan: { bills: PlanBill[]; warnings: string[]; totalOpenCents: number };
  skipped: Array<{ vendorName: string; invoiceNumber: string | null }>;
}

interface CommitResponse {
  dryRun: false;
  summary: ImportSummary;
  created: Array<{ vendorName: string; totalCents: number }>;
  skipped: Array<{ vendorName: string; invoiceNumber: string | null }>;
  warnings: string[];
}

export function QboApImportClient({ apiBaseUrl }: { apiBaseUrl: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function post(dryRun: boolean) {
    if (csv.trim().length === 0) {
      setError('Choose a CSV file or paste the export first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ap-invoices/import-qbo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun }),
      });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        const e = body as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      if (dryRun) {
        setPreview(body as DryRunResponse);
        setResult(null);
      } else {
        setResult(body as CommitResponse);
        setPreview(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">
          QuickBooks A/P aging export (CSV)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onFile(e)}
            className="mt-2 block w-full text-sm"
          />
        </label>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gray-500">
            …or paste the CSV directly
          </summary>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            rows={6}
            className="mt-2 w-full rounded border border-gray-300 p-2 font-mono text-xs"
            placeholder="Date,Num,Vendor,Due Date,Open Balance"
          />
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void post(true)}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Preview mapping'}
          </button>
          {preview && preview.summary.willCreate > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void post(false)}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Import {preview.summary.willCreate} bill
              {preview.summary.willCreate === 1 ? '' : 's'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      {result && (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            Imported {result.created.length} open bill
            {result.created.length === 1 ? '' : 's'}.
          </h2>
          <p className="mt-1 text-xs text-green-900">
            Skipped {result.skipped.length} (already on file),{' '}
            {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}.
          </p>
          <a href="/ap-invoices" className="mt-2 inline-block text-sm font-semibold text-green-800 hover:underline">
            View AP invoices →
          </a>
        </div>
      )}

      {preview && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Parsed rows" value={String(preview.summary.parsedRows)} />
            <Stat label="Will create" value={String(preview.summary.willCreate)} tone="good" />
            <Stat label="Will skip" value={String(preview.summary.willSkip)} />
            <Stat label="Total open" value={usd(preview.summary.totalOpenCents)} tone="good" />
          </section>

          {preview.plan.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-semibold uppercase tracking-wide">Warnings ({preview.plan.warnings.length})</div>
              <ul className="mt-1 list-disc pl-5">
                {preview.plan.warnings.slice(0, 50).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <section className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Open bills to create ({preview.plan.bills.length})
            </h2>
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1">Vendor</th>
                  <th className="py-1">Bill #</th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Due</th>
                  <th className="py-1 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.plan.bills.map((b, idx) => (
                  <tr key={b.vendorName + (b.invoiceNumber ?? '') + idx}>
                    <td className="py-1">{b.vendorName}</td>
                    <td className="py-1 font-mono">{b.invoiceNumber ?? '—'}</td>
                    <td className="py-1">{b.invoiceDate}</td>
                    <td className="py-1">{b.dueDate ?? '—'}</td>
                    <td className="py-1 text-right font-mono">{usd(b.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
