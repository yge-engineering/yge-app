// /bank-recs/[id] — AI auto-match panel.
//
// Bookkeeper pastes a CSV of unmatched bank-statement rows, hits
// Match, and sees an AI suggestion per row. This is the consumer
// for the bundle 1370 matcher library + the bundle 1414 endpoint.

'use client';

import { useRef, useState } from "react";

interface ParsedTx {
  date: string;
  description: string;
  amountCents: number;
}

interface MatchResult {
  transactionIdx: number;
  candidateId: string | null;
  candidateKind: 'ar_payment' | 'ap_payment' | 'expense' | 'journal_entry' | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string;
}

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function parseAmount(s: string): number | null {
  // Accepts: "1234.56", "-1234.56", "$1,234.56", "(1,234.56)" (parens
  // = negative — common in bank exports). Returns cents.
  let raw = s.trim().replace(/\$/g, '').replace(/,/g, '');
  let negative = false;
  if (raw.startsWith('(') && raw.endsWith(')')) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (raw.startsWith('-')) {
    negative = true;
    raw = raw.slice(1);
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  const cents = Math.round(num * 100);
  return negative ? -cents : cents;
}

function parseCsv(text: string): { ok: ParsedTx[]; bad: number } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const ok: ParsedTx[] = [];
  let bad = 0;
  for (const line of lines) {
    // Skip an obvious header row.
    if (/^date\s*[,;]/i.test(line)) continue;
    const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) {
      bad += 1;
      continue;
    }
    const [date, description, amount] = cols;
    if (!date || !description || amount === undefined) {
      bad += 1;
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      bad += 1;
      continue;
    }
    const amountCents = parseAmount(amount);
    if (amountCents === null) {
      bad += 1;
      continue;
    }
    ok.push({ date, description, amountCents });
  }
  return { ok, bad };
}

function fmtCents(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}$${dollars.toLocaleString()}.${String(cents).padStart(2, '0')}`;
}

function confidenceTone(c: MatchResult['confidence']): string {
  switch (c) {
    case 'HIGH': return 'bg-green-100 text-green-800 border-green-300';
    case 'MEDIUM': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'LOW': return 'bg-orange-100 text-orange-800 border-orange-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

export function BankRecMatchPanel({ recId }: { recId: string }) {
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedTx[] | null>(null);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function onMatch() {
    setError(null);
    setResults(null);
    const { ok, bad } = parseCsv(csv);
    setParsed(ok);
    if (ok.length === 0) {
      setError(
        bad > 0
          ? `Couldn't parse any rows (${bad} skipped). Expected: date,description,amount per line.`
          : 'Paste at least one transaction row.',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/bank-recs/${recId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: ok }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Match failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        matches: MatchResult[];
        candidateCount: number;
      };
      setResults(body.matches);
      setCandidateCount(body.candidateCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-900">
        Auto-match transactions (AI)
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Paste unmatched bank-statement rows below — one per line, format:
        {' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-xs">
          YYYY-MM-DD,description,amount
        </code>
        . Negative amounts = withdrawals.
      </p>
      <OfxUploadRow recId={recId} onParsed={(csv) => setCsv(csv)} />
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={6}
        placeholder="2026-04-30,CALTRANS WIRE TX 12345,250000.00&#10;2026-05-01,KNIFE RIVER CK 4521,-45000.00"
        className="mt-3 w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
        disabled={busy}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onMatch}
          disabled={busy || csv.trim().length === 0}
          className="rounded-md bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Matching…' : 'Match with AI'}
        </button>
        {parsed ? (
          <span className="text-xs text-gray-500">
            {parsed.length} transaction{parsed.length === 1 ? '' : 's'} parsed
            {candidateCount !== null
              ? ` · ${candidateCount} candidate${candidateCount === 1 ? '' : 's'}`
              : null}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {results && parsed ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parsed.map((tx, i) => {
                const r = results[i];
                if (!r) return null;
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-xs">{tx.date}</td>
                    <td className="px-3 py-2">{tx.description}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtCents(tx.amountCents)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {r.candidateId
                        ? `${r.candidateKind?.replace('_', ' ')} ${r.candidateId}`
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${confidenceTone(r.confidence)}`}
                      >
                        {r.confidence}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {r.reasoning}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ApplyControls
            recId={recId}
            matches={results}
            onApplied={(ids) => setApplied((prev) => new Set([...prev, ...ids]))}
            applied={applied}
          />
        </div>
      ) : null}
    </section>
  );
}



function OfxUploadRow({
  recId,
  onParsed,
}: {
  recId: string;
  onParsed: (csv: string) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `${apiBaseUrl()}/api/bank-recs/${recId}/import-ofx`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Import failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        transactions: Array<{ date: string; description: string; amountCents: number }>;
        statementStartDate: string | null;
        statementEndDate: string | null;
      };
      // Convert parsed transactions into the same CSV the existing
      // match flow expects.
      const lines = body.transactions.map((t) => {
        const dollars = (t.amountCents / 100).toFixed(2);
        const safeDesc = t.description.replace(/[,\n\r]/g, ' ');
        return `${t.date},${safeDesc},${dollars}`;
      });
      onParsed(lines.join('\n'));
      const range =
        body.statementStartDate && body.statementEndDate
          ? `${body.statementStartDate} → ${body.statementEndDate}`
          : '';
      setSummary(
        `${body.transactions.length} transaction${body.transactions.length === 1 ? '' : 's'} parsed${range ? ` (${range})` : ''}. Click "Match with AI" below.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="text-xs text-gray-800">Or import OFX/QFX:</strong>
        <input
          ref={ref}
          type="file"
          accept=".ofx,.qfx,application/x-ofx"
          onChange={onChange}
          disabled={busy}
          className="text-xs"
        />
        {busy ? <span className="text-xs text-gray-700">Parsing…</span> : null}
        <span className="text-[11px] text-gray-500">
          Most banks let you export OFX from your statement page for free.
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
      {summary ? (
        <p className="mt-2 text-xs text-green-800">{summary}</p>
      ) : null}
    </div>
  );
}

function ApplyControls({
  recId,
  matches,
  applied,
  onApplied,
}: {
  recId: string;
  matches: MatchResult[];
  applied: Set<string>;
  onApplied: (candidateIds: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const eligibleHigh = matches.filter(
    (m) =>
      (m.candidateKind === 'ap_payment' ||
        m.candidateKind === 'ar_payment' ||
        m.candidateKind === 'expense') &&
      m.confidence === 'HIGH' &&
      m.candidateId &&
      !applied.has(m.candidateId),
  );

  async function postApply(rows: MatchResult[]) {
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        matches: rows
          .filter((m) => m.candidateId && m.candidateKind)
          .map((m) => ({
            candidateId: m.candidateId as string,
            candidateKind: m.candidateKind as
              | 'ar_payment'
              | 'ap_payment'
              | 'expense'
              | 'journal_entry',
          })),
      };
      const res = await fetch(
        `${apiBaseUrl()}/api/bank-recs/${recId}/apply-matches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(errBody.error ?? `Apply failed (${res.status})`);
        return;
      }
      const out = (await res.json()) as {
        appliedAp: number;
        appliedAr: number;
        appliedExpense: number;
        appliedJournalEntry: number;
        clearedOn: string;
      };
      const parts: string[] = [];
      if (out.appliedAp) parts.push(`${out.appliedAp} AP payment${out.appliedAp === 1 ? '' : 's'}`);
      if (out.appliedAr) parts.push(`${out.appliedAr} AR payment${out.appliedAr === 1 ? '' : 's'}`);
      if (out.appliedExpense) parts.push(`${out.appliedExpense} expense${out.appliedExpense === 1 ? '' : 's'}`);
      const headline = parts.length
        ? `Marked ${parts.join(', ')} cleared (${out.clearedOn}).`
        : `No matches applied (${out.clearedOn}).`;
      const tail = out.appliedJournalEntry
        ? ` ${out.appliedJournalEntry} journal-entry match${out.appliedJournalEntry === 1 ? '' : 'es'} skipped (no cleared flag yet).`
        : '';
      setSummary(headline + tail);
      onApplied(
        rows
          .map((r) => r.candidateId)
          .filter((id): id is string => !!id),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => postApply(eligibleHigh)}
          disabled={busy || eligibleHigh.length === 0}
          className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy
            ? 'Applying…'
            : `Apply HIGH matches (${eligibleHigh.length})`}
        </button>
        <span className="text-xs text-gray-500">
          Marks each AP / AR payment + expense cleared=true with
          clearedOn=statement date. Journal-entry matches stay
          read-only (no cleared flag on those rows yet).
        </span>
      </div>
      {summary ? (
        <p className="mt-2 rounded-md border border-green-300 bg-green-50 p-2 text-xs text-green-800">
          {summary}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
