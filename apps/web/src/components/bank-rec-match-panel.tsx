// /bank-recs/[id] — AI auto-match panel.
//
// Bookkeeper pastes a CSV of unmatched bank-statement rows, hits
// Match, and sees an AI suggestion per row. This is the consumer
// for the bundle 1370 matcher library + the bundle 1414 endpoint.

'use client';

import { useState } from 'react';

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
          <p className="mt-3 text-xs text-gray-500">
            Apply-button + per-row accept/reject ships next. For now, this
            is the read-only review pane — the bookkeeper still posts the
            match through the rec editor below.
          </p>
        </div>
      ) : null}
    </section>
  );
}
