'use client';

// Manual journal-entry form.
//
// Plain English: enter a date + memo + N lines (must be at least 2,
// each line is either a debit or a credit). The running balance
// totals at the bottom must hit zero — that's the GAAP rule that
// every journal entry has to balance.
//
// Save as DRAFT (doesn't affect trial balance) or POSTED (does).

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  JournalEntryCreate,
  JournalEntrySource,
  JournalEntryStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function dollarsToCents(input: string): number {
  const n = Number.parseFloat(input.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
function fmtCents(c: number): string {
  const dollars = Math.floor(Math.abs(c) / 100);
  const cents = Math.abs(c) % 100;
  return `${c < 0 ? '-' : ''}$${dollars.toLocaleString('en-US')}.${cents.toString().padStart(2, '0')}`;
}

const SOURCES: JournalEntrySource[] = [
  'MANUAL', 'AP_INVOICE', 'AP_PAYMENT', 'AR_INVOICE', 'AR_PAYMENT',
  'PAYROLL', 'DEPRECIATION', 'CASH_TRANSFER', 'ADJUSTING', 'CLOSING', 'OTHER',
];

interface DraftLine {
  /** Unique key for React; not sent to server. */
  key: string;
  accountNumber: string;
  debitDollars: string;
  creditDollars: string;
  memo: string;
  jobId: string;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    accountNumber: '',
    debitDollars: '',
    creditDollars: '',
    memo: '',
    jobId: '',
  };
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-xs';
const selectClass = 'rounded border border-gray-300 px-2 py-1 text-xs bg-white';
const moneyClass = 'w-28 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono';

export function JournalEntryNewForm() {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [source, setSource] = useState<JournalEntrySource>('MANUAL');
  const [sourceRef, setSourceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(idx: number, patch: Partial<DraftLine>): void {
    setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addLine(): void {
    setLines((rows) => [...rows, blankLine()]);
  }
  function removeLine(idx: number): void {
    setLines((rows) => (rows.length <= 2 ? rows : rows.filter((_, i) => i !== idx)));
  }

  const debitTotal = lines.reduce((s, l) => s + dollarsToCents(l.debitDollars), 0);
  const creditTotal = lines.reduce((s, l) => s + dollarsToCents(l.creditDollars), 0);
  const balanced = debitTotal > 0 && debitTotal === creditTotal;
  const diff = debitTotal - creditTotal;

  async function save(status: JournalEntryStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (memo.trim().length === 0) {
        setError('Memo is required.');
        return;
      }
      // Build payload — drop blank lines + map dollars to cents.
      const payloadLines = lines
        .map((l) => ({
          accountNumber: l.accountNumber.trim(),
          debitCents: dollarsToCents(l.debitDollars),
          creditCents: dollarsToCents(l.creditDollars),
          memo: l.memo.trim() || undefined,
          jobId: l.jobId.trim() || undefined,
        }))
        .filter((l) => l.accountNumber.length > 0 && (l.debitCents > 0 || l.creditCents > 0));
      if (payloadLines.length < 2) {
        setError('Need at least two posting lines.');
        return;
      }
      if (status === 'POSTED' && !balanced) {
        setError(`Debits ($${(debitTotal / 100).toFixed(2)}) must equal credits ($${(creditTotal / 100).toFixed(2)}) before posting.`);
        return;
      }

      const payload: JournalEntryCreate = {
        entryDate,
        memo: memo.trim(),
        source,
        sourceRef: sourceRef.trim() || undefined,
        status,
        lines: payloadLines,
        notes: notes.trim() || undefined,
      };
      const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      router.push('/journal-entries');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Entry date">
            <input type="date" value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Memo (required)" wide>
            <input type="text" value={memo}
              onChange={(e) => setMemo(e.target.value)} className={inputClass}
              placeholder="e.g. October fuel accrual" />
          </Field>
          <Field label="Source">
            <select value={source}
              onChange={(e) => setSource(e.target.value as JournalEntrySource)}
              className={selectClass + ' w-full'}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Source reference (optional)">
            <input type="text" value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)} className={inputClass}
              placeholder="e.g. ap-2026-04-31" />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <div className="text-sm font-semibold text-gray-800">Posting lines</div>
          <button type="button" onClick={addLine}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
            + Add line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left">Account #</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-left">Line memo</th>
                <th className="px-2 py-2 text-left">Job (optional)</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l, i) => (
                <tr key={l.key}>
                  <td className="px-2 py-1.5">
                    <input type="text" inputMode="numeric" value={l.accountNumber}
                      onChange={(e) => updateLine(i, { accountNumber: e.target.value })}
                      placeholder="4-6 digit" className={inputClass + ' font-mono w-28'} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input type="text" inputMode="decimal" value={l.debitDollars}
                      onChange={(e) => updateLine(i, { debitDollars: e.target.value, creditDollars: '' })}
                      placeholder="0.00" className={moneyClass} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input type="text" inputMode="decimal" value={l.creditDollars}
                      onChange={(e) => updateLine(i, { creditDollars: e.target.value, debitDollars: '' })}
                      placeholder="0.00" className={moneyClass} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={l.memo}
                      onChange={(e) => updateLine(i, { memo: e.target.value })}
                      className={inputClass} placeholder="(optional)" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={l.jobId}
                      onChange={(e) => updateLine(i, { jobId: e.target.value })}
                      className={inputClass + ' font-mono'} placeholder="(optional)" />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {lines.length > 2 && (
                      <button type="button" onClick={() => removeLine(i)}
                        title="Remove line"
                        className="rounded border border-red-300 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="px-2 py-2 text-right text-xs uppercase tracking-wide text-gray-500">Totals</td>
                <td className="px-2 py-2 text-right font-mono">{fmtCents(debitTotal)}</td>
                <td className="px-2 py-2 text-right font-mono">{fmtCents(creditTotal)}</td>
                <td colSpan={3} className="px-2 py-2 text-xs">
                  {balanced ? (
                    <span className="text-green-700">Balanced ✓</span>
                  ) : diff === 0 && debitTotal === 0 ? (
                    <span className="text-gray-500">Enter at least two posting lines.</span>
                  ) : (
                    <span className="text-red-700">
                      Off by {fmtCents(Math.abs(diff))} — {diff > 0 ? 'debits exceed credits' : 'credits exceed debits'}.
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Internal notes (optional, not printed)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => save('DRAFT')}
          className="rounded border border-yge-blue-500 px-4 py-2 text-sm font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
          Save as draft
        </button>
        <button type="button" disabled={busy || !balanced} onClick={() => save('POSTED')}
          title={balanced ? 'Post to GL — affects trial balance' : 'Debits must equal credits before posting'}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Post to GL'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-xs ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
