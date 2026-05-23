'use client';

// /parts-classify — paste part descriptions, get auto-classified
// EquipmentPartCategory tags.
//
// Wires bundle 2493's POST /api/equipment-part/classify into a real
// shop-side tool. Mechanic or shop foreman pastes a list of AP
// invoice descriptions (or just unknown parts off a shelf), gets
// back the heuristic classification + a count of unclassified rows
// that need human cleanup or an AI second pass.

import { useState } from 'react';
import { AppShell, PageHeader, Tile } from '../../components';
import type { EquipmentPartCategory } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ClassifyResult {
  items: Array<{ id?: string; description: string; category: EquipmentPartCategory }>;
  summary: { total: number; classified: number; unclassified: number };
}

export default function PartsClassifyPage() {
  const [text, setText] = useState(
    `# One description per line. Optional pipe-separated manufacturer:
CAT 1R-0750 oil filter
Donaldson P181135 air filter | Donaldson
15W40 engine oil, 1 gal
fuel/water separator
hydraulic hose 1/2 x 60"
bucket tooth K-series
Group 31 battery 1000 CCA
M16 cap screw, 50mm
mystery widget part`,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runClassify() {
    setError(null);
    setResult(null);
    const items = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((line, idx) => {
        const [desc, mfr] = line.split('|').map((s) => s.trim());
        return {
          id: `r${idx + 1}`,
          description: desc ?? line,
          manufacturer: mfr || undefined,
        };
      });
    if (items.length === 0) {
      setError('No descriptions to classify.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/equipment-part/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as ClassifyResult;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Parts classifier"
          subtitle="Paste a list of part descriptions; get heuristic EquipmentPartCategory tags. The 'OTHER' rows need a human (or a future AI second pass)."
        />

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Descriptions</h2>
          <p className="mt-1 text-sm text-gray-600">
            One per line. Lines starting with <span className="font-mono">#</span> are skipped.
            Optional <span className="font-mono">| manufacturer</span> after the description.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="mt-3 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          />
          {error && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={runClassify}
              disabled={busy}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {busy ? 'Classifying…' : 'Classify'}
            </button>
          </div>
        </section>

        {result && (
          <section className="mt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Total" value={String(result.summary.total)} />
              <Tile label="Classified" value={String(result.summary.classified)} />
              <Tile label="OTHER (needs review)" value={String(result.summary.unclassified)} />
            </div>

            <table className="mt-6 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2">Description</th>
                  <th className="py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((it, i) => (
                  <tr key={`${it.id}-${i}`} className="border-t border-gray-200">
                    <td className="py-2 text-gray-900">{it.description}</td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-mono ${
                          it.category === 'OTHER'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-green-100 text-green-900'
                        }`}
                      >
                        {it.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </AppShell>
  );
}
