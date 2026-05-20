'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlanAccount {
  sourceFullName: string;
  number: string;
  name: string;
  type: string;
  parentNumber?: string;
  description?: string;
}

interface ImportSummary {
  parsedRows: number;
  mapped: number;
  willCreate: number;
  willSkip: number;
  unmapped: number;
  warnings: number;
  created?: number;
}

interface UnmappedRow {
  fullName: string;
  qboType: string;
  reason: string;
}

interface DryRunResponse {
  dryRun: true;
  summary: ImportSummary;
  plan: { accounts: PlanAccount[]; unmapped: UnmappedRow[]; warnings: string[] };
  skipped: Array<{ number: string; name: string }>;
}

interface CommitResponse {
  dryRun: false;
  summary: ImportSummary;
  created: Array<{ number: string; name: string; type: string }>;
  skipped: Array<{ number: string; name: string }>;
  unmapped: UnmappedRow[];
  warnings: string[];
}

export function QboCoaImportClient({ apiBaseUrl }: { apiBaseUrl: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
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
      const res = await fetch(`${apiBaseUrl}/api/coa/import-qbo`, {
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
          QuickBooks COA export (CSV)
          <input
            ref={fileRef}
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
            placeholder="Account Number,Account Name,Type,Detail Type,Balance&#10;10000,Checking,Bank,Checking,12500.00"
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
              Import {preview.summary.willCreate} account
              {preview.summary.willCreate === 1 ? '' : 's'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      {result && (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            Imported {result.created.length} account
            {result.created.length === 1 ? '' : 's'}.
          </h2>
          <p className="mt-1 text-xs text-green-900">
            Skipped {result.skipped.length} (number already existed),{' '}
            {result.unmapped.length} unmapped,{' '}
            {result.warnings.length} warning
            {result.warnings.length === 1 ? '' : 's'}.
          </p>
          <a href="/coa" className="mt-2 inline-block text-sm font-semibold text-green-800 hover:underline">
            View chart of accounts →
          </a>
        </div>
      )}

      {preview && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Parsed rows" value={preview.summary.parsedRows} />
            <Stat label="Will create" value={preview.summary.willCreate} tone="good" />
            <Stat label="Will skip" value={preview.summary.willSkip} />
            <Stat label="Unmapped" value={preview.summary.unmapped} tone={preview.summary.unmapped > 0 ? 'warn' : undefined} />
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

          {preview.plan.unmapped.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-900">
              <div className="font-semibold uppercase tracking-wide">
                Unmapped rows (not imported)
              </div>
              <ul className="mt-1 list-disc pl-5">
                {preview.plan.unmapped.map((u) => (
                  <li key={u.fullName}>
                    <span className="font-semibold">{u.fullName}</span> — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Accounts to create ({preview.plan.accounts.length})
            </h2>
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1">QuickBooks name</th>
                  <th className="py-1">#</th>
                  <th className="py-1">Name</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Parent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.plan.accounts.map((a) => {
                  const willSkip = preview.skipped.some((s) => s.number === a.number);
                  return (
                    <tr key={a.sourceFullName} className={willSkip ? 'text-gray-400' : ''}>
                      <td className="py-1">{a.sourceFullName}</td>
                      <td className="py-1 font-mono">{a.number}</td>
                      <td className="py-1">{a.name}</td>
                      <td className="py-1">{a.type}</td>
                      <td className="py-1 font-mono text-gray-500">{a.parentNumber ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.summary.willSkip > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                Grayed rows already exist (matched by number) and will be left
                untouched.
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
