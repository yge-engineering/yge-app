'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlanCustomer {
  sourceName: string;
  legalName: string;
  dbaName?: string;
  kind: string;
  contactName?: string;
  email?: string;
}

interface ImportSummary {
  parsedRows: number;
  mapped: number;
  willCreate: number;
  willSkip: number;
  warnings: number;
  created?: number;
}

interface DryRunResponse {
  dryRun: true;
  summary: ImportSummary;
  plan: { customers: PlanCustomer[]; warnings: string[] };
  skipped: Array<{ legalName: string }>;
}

interface CommitResponse {
  dryRun: false;
  summary: ImportSummary;
  created: Array<{ legalName: string; kind: string }>;
  skipped: Array<{ legalName: string }>;
  warnings: string[];
}

export function QboCustomerImportClient({ apiBaseUrl }: { apiBaseUrl: string }) {
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
      const res = await fetch(`${apiBaseUrl}/api/customers/import-qbo`, {
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
          QuickBooks customer export (CSV)
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
            placeholder="Customer,Company,Email,Billing City,Billing State,Terms"
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
              Import {preview.summary.willCreate} customer
              {preview.summary.willCreate === 1 ? '' : 's'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      {result && (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            Imported {result.created.length} customer
            {result.created.length === 1 ? '' : 's'}.
          </h2>
          <p className="mt-1 text-xs text-green-900">
            Skipped {result.skipped.length} (name already existed),{' '}
            {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}.
          </p>
          <a href="/customers" className="mt-2 inline-block text-sm font-semibold text-green-800 hover:underline">
            View customers →
          </a>
        </div>
      )}

      {preview && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Parsed rows" value={preview.summary.parsedRows} />
            <Stat label="Will create" value={preview.summary.willCreate} tone="good" />
            <Stat label="Will skip" value={preview.summary.willSkip} />
            <Stat label="Warnings" value={preview.summary.warnings} tone={preview.summary.warnings > 0 ? 'warn' : undefined} />
          </section>

          {preview.plan.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-semibold uppercase tracking-wide">Warnings</div>
              <ul className="mt-1 list-disc pl-5">
                {preview.plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <section className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Customers to create ({preview.plan.customers.length})
            </h2>
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1">Legal name</th>
                  <th className="py-1">DBA</th>
                  <th className="py-1">Kind (guess)</th>
                  <th className="py-1">Contact</th>
                  <th className="py-1">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.plan.customers.map((c) => {
                  const willSkip = preview.skipped.some(
                    (s) => s.legalName.toLowerCase() === c.legalName.toLowerCase(),
                  );
                  return (
                    <tr key={c.sourceName + c.legalName} className={willSkip ? 'text-gray-400' : ''}>
                      <td className="py-1">{c.legalName}</td>
                      <td className="py-1">{c.dbaName ?? '—'}</td>
                      <td className="py-1">{c.kind}</td>
                      <td className="py-1">{c.contactName ?? '—'}</td>
                      <td className="py-1">{c.email ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.summary.willSkip > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                Grayed rows already exist (matched by legal name) and will be
                left untouched.
              </p>
            )}
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
  value: number;
  tone?: 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
