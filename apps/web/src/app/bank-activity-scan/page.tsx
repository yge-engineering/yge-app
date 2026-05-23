'use client';

// /bank-activity-scan — paste transactions, get anomaly flags.
//
// Wires bundle 2489's /api/bank-anomaly/scan into a real bookkeeper
// page. Input is a CSV the user can paste from a downloaded bank
// statement or from Excel:
//   YYYY-MM-DD, merchant, amount(+/-), [optional fitId]
//
// Negative amount = debit, positive = credit. The page parses lines
// client-side, POSTs them as OFX-shape objects (the scan endpoint
// accepts either shape), and renders the resulting BankAnomaly[]
// grouped by severity.

import { useState } from 'react';
import { AppShell, PageHeader, Tile } from '../../components';
import type { BankAnomaly } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ParsedRow {
  date: string;
  description: string;
  amountCents: number;
  fitId: string | null;
  trnType: null;
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 3) {
        errors.push(`Line ${idx + 1}: need at least date,description,amount`);
        return;
      }
      const [date, description, amountStr, fitId] = cols;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
        errors.push(`Line ${idx + 1}: date must be yyyy-mm-dd (got "${date}")`);
        return;
      }
      const dollars = Number(amountStr);
      if (!Number.isFinite(dollars)) {
        errors.push(`Line ${idx + 1}: bad amount "${amountStr}"`);
        return;
      }
      rows.push({
        date: date!,
        description: description ?? '(no description)',
        amountCents: Math.round(dollars * 100),
        fitId: fitId?.trim() ? fitId.trim() : null,
        trnType: null,
      });
    });
  return { rows, errors };
}

const SEVERITY_TONE: Record<BankAnomaly['severity'], string> = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
};

const SEVERITY_LABEL: Record<BankAnomaly['severity'], string> = {
  critical: 'Critical',
  warn: 'Warn',
  info: 'Info',
};

export default function BankActivityScanPage() {
  const [csv, setCsv] = useState(
    `# Paste rows like:  yyyy-mm-dd, merchant, amount(+/-), [fitId]
2026-05-01, Acme Hardware, -157.42, FIT-A
2026-05-02, Acme Hardware, -157.42, FIT-B
2026-05-04, Cashiers Check, -10000.00`,
  );
  const [knownMerchants, setKnownMerchants] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ anomalies: BankAnomaly[]; transactionCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setError(null);
    setResult(null);
    const { rows, errors } = parseCsv(csv);
    if (errors.length > 0) {
      setError(errors.slice(0, 3).join('; '));
      return;
    }
    if (rows.length === 0) {
      setError('No rows to scan.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/bank-anomaly/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: rows,
          knownMerchants: knownMerchants
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Scan failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        anomalies: BankAnomaly[];
        transactionCount: number;
      };
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const flagsBySeverity = result
    ? {
        critical: result.anomalies.filter((a) => a.severity === 'critical'),
        warn: result.anomalies.filter((a) => a.severity === 'warn'),
        info: result.anomalies.filter((a) => a.severity === 'info'),
      }
    : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Bank activity scan"
          subtitle="Paste recent bank-statement rows. The scanner flags duplicate charges, fee creep, unusual amounts, large round checks, weekend large debits, and (with a known-vendor list) new-vendor spend."
        />

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Transactions (CSV)</h2>
          <p className="mt-1 text-sm text-gray-600">
            One per line: <span className="font-mono">yyyy-mm-dd, merchant, amount, [fitId]</span>.
            Negative amount = debit. Lines starting with # are ignored.
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            className="mt-3 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          />

          <h3 className="mt-4 text-sm font-semibold text-gray-700">Known vendors (optional, comma-separated)</h3>
          <p className="text-xs text-gray-500">
            Enables NEW_VENDOR_LARGE flagging — debits ≥ $2.5k to merchants NOT in this list.
          </p>
          <textarea
            value={knownMerchants}
            onChange={(e) => setKnownMerchants(e.target.value)}
            rows={2}
            placeholder="Acme Hardware, Bay Aggregate, ..."
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />

          {error && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={runScan}
              disabled={busy}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {busy ? 'Scanning…' : 'Run scan'}
            </button>
          </div>
        </section>

        {result && flagsBySeverity && (
          <section className="mt-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Tile label="Scanned" value={String(result.transactionCount)} />
              <Tile label="Critical" value={String(flagsBySeverity.critical.length)} />
              <Tile label="Warn" value={String(flagsBySeverity.warn.length)} />
              <Tile label="Info" value={String(flagsBySeverity.info.length)} />
            </div>

            {result.anomalies.length === 0 ? (
              <p className="mt-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
                No anomalies flagged across {result.transactionCount} transactions.
              </p>
            ) : (
              <ul className="mt-6 space-y-2">
                {(['critical', 'warn', 'info'] as const).flatMap((sev) =>
                  flagsBySeverity[sev].map((a, i) => (
                    <li
                      key={`${a.code}-${i}-${a.transactionIds.join('-')}`}
                      className={`rounded border-l-4 px-4 py-3 text-sm ${SEVERITY_TONE[a.severity]}`}
                    >
                      <div className="font-mono text-xs uppercase tracking-wide opacity-70">
                        {SEVERITY_LABEL[a.severity]} · {a.code}
                      </div>
                      <div className="mt-1">{a.message}</div>
                      <div className="mt-1 font-mono text-xs opacity-60">
                        tx: {a.transactionIds.join(', ')}
                      </div>
                    </li>
                  )),
                )}
              </ul>
            )}
          </section>
        )}
      </main>
    </AppShell>
  );
}
