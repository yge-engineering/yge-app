'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

interface MatchedLine {
  accountNumber: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
}

interface Unmatched {
  accountRef: string;
  netDebitCents: number;
  reason: string;
}

interface ImportSummary {
  parsedRows: number;
  lines: number;
  matched: number;
  unmatched: number;
  totalDebitCents: number;
  totalCreditCents: number;
  balanced: boolean;
  plugNetDebitCents: number;
  warnings: number;
}

interface DryRunResponse {
  dryRun: true;
  summary: ImportSummary;
  result: {
    entry: { lines: unknown[] } | null;
    matched: MatchedLine[];
    unmatched: Unmatched[];
    plugNetDebitCents: number;
    warnings: string[];
    totalDebitCents: number;
    totalCreditCents: number;
  };
}

interface CommitResponse {
  dryRun: false;
  summary: ImportSummary;
  journalEntryId: string;
  status: string;
}

export function QboTrialBalanceImportClient({ apiBaseUrl }: { apiBaseUrl: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [entryDate, setEntryDate] = useState('');
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      setError('Pick a cutover date first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/journal-entries/import-qbo-trial-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, entryDate, dryRun }),
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Trial Balance export (CSV)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e)}
              className="mt-2 block w-full text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Cutover date (posting date)
            <input
              type="date"
              value={entryDate}
              onChange={(e) => {
                setEntryDate(e.target.value);
                setPreview(null);
                setResult(null);
              }}
              className="mt-2 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
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
            placeholder="Account,Debit,Credit"
          />
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void post(true)}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Preview entry'}
          </button>
          {preview && preview.summary.balanced && preview.summary.lines >= 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void post(false)}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Create draft entry ({preview.summary.lines} lines)
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      {result && (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            Draft opening entry created ({result.status}).
          </h2>
          <p className="mt-1 text-xs text-green-900">
            Review it and post it to the GL when you&apos;re happy. Posting is a
            deliberate step — nothing hits the ledger until you post.
          </p>
          <a
            href={`/journal-entries/${result.journalEntryId}`}
            className="mt-2 inline-block text-sm font-semibold text-green-800 hover:underline"
          >
            Review &amp; post the entry →
          </a>
        </div>
      )}

      {preview && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Matched accounts" value={String(preview.summary.matched)} tone="good" />
            <Stat label="Unmatched" value={String(preview.summary.unmatched)} tone={preview.summary.unmatched > 0 ? 'warn' : undefined} />
            <Stat label="Total debits" value={usd(preview.summary.totalDebitCents)} />
            <Stat
              label={preview.summary.balanced ? 'Balanced ✓' : 'OUT OF BALANCE'}
              value={usd(preview.summary.totalCreditCents)}
              tone={preview.summary.balanced ? 'good' : 'bad'}
            />
          </section>

          {preview.summary.plugNetDebitCents !== 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Opening Balance Equity plug:{' '}
              <strong>
                {preview.summary.plugNetDebitCents > 0 ? 'debit ' : 'credit '}
                {usd(Math.abs(preview.summary.plugNetDebitCents))}
              </strong>{' '}
              — absorbs unmatched accounts and rounding so the entry balances.
            </div>
          )}

          {preview.result.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-semibold uppercase tracking-wide">Warnings</div>
              <ul className="mt-1 list-disc pl-5">
                {preview.result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.result.unmatched.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-900">
              <div className="font-semibold uppercase tracking-wide">
                Unmatched accounts (folded into Opening Balance Equity)
              </div>
              <ul className="mt-1 list-disc pl-5">
                {preview.result.unmatched.map((u) => (
                  <li key={u.accountRef}>
                    {u.accountRef} — {usd(Math.abs(u.netDebitCents))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Opening entry lines ({preview.result.matched.length})
            </h2>
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="py-1">#</th>
                  <th className="py-1">Account</th>
                  <th className="py-1 text-right">Debit</th>
                  <th className="py-1 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.result.matched.map((m) => (
                  <tr key={m.accountNumber}>
                    <td className="py-1 font-mono">{m.accountNumber}</td>
                    <td className="py-1">{m.accountName}</td>
                    <td className="py-1 text-right font-mono">{m.debitCents > 0 ? usd(m.debitCents) : ''}</td>
                    <td className="py-1 text-right font-mono">{m.creditCents > 0 ? usd(m.creditCents) : ''}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-semibold">
                  <td className="py-1.5" colSpan={2}>Total</td>
                  <td className="py-1.5 text-right font-mono">{usd(preview.result.totalDebitCents)}</td>
                  <td className="py-1.5 text-right font-mono">{usd(preview.result.totalCreditCents)}</td>
                </tr>
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
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-red-700'
          : 'text-yge-blue-900';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
