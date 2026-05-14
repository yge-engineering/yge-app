// /imported-estimates/compare?a=…&b=… — side-by-side two estimates.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ImportedEstimate, ImportedEstimateLine } from '@yge/shared';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEstimate(id: string): Promise<ImportedEstimate | null> {
  const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return ((await res.json()) as { importedEstimate: ImportedEstimate }).importedEstimate;
}

async function fetchAll(): Promise<ImportedEstimate[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { importedEstimates?: ImportedEstimate[] };
    return body.importedEstimates ?? [];
  } catch {
    return [];
  }
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function sumByCostCode(lines: ImportedEstimateLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const ln of lines) {
    const k = (ln.costCode ?? '').toUpperCase().trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + ln.bidPriceCents);
  }
  return m;
}

export default async function CompareEstimatesPage({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  requirePermission('estimates:view');
  const all = await fetchAll();
  const a = searchParams.a ? await fetchEstimate(searchParams.a) : null;
  const b = searchParams.b ? await fetchEstimate(searchParams.b) : null;

  const aMap = a ? sumByCostCode(a.lines) : new Map<string, number>();
  const bMap = b ? sumByCostCode(b.lines) : new Map<string, number>();
  const allCodes = new Set<string>([...aMap.keys(), ...bMap.keys()]);
  const rows = [...allCodes].map((code) => {
    const ab = aMap.get(code) ?? 0;
    const bb = bMap.get(code) ?? 0;
    return { code, a: ab, b: bb, diff: bb - ab };
  });
  rows.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Compare estimates"
          subtitle="Pick two imported estimates to see a side-by-side bid diff per cost code."
        />

        <form className="mb-6 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700">Estimate A</span>
            <select name="a" defaultValue={searchParams.a ?? ''} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">— pick estimate A —</option>
              {all.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.jobNumber} · {e.projectName} ({fmtMoney(e.bidPriceCents)})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-700">Estimate B</span>
            <select name="b" defaultValue={searchParams.b ?? ''} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">— pick estimate B —</option>
              {all.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.jobNumber} · {e.projectName} ({fmtMoney(e.bidPriceCents)})
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-md bg-yge-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700">
              Compare
            </button>
          </div>
        </form>

        {a && b ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <EstimateCard est={a} />
              <EstimateCard est={b} />
            </div>

            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Cost-code differences (Bid B &minus; Bid A)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-3 py-2">Cost code</th>
                    <th className="px-3 py-2 text-right">Bid A</th>
                    <th className="px-3 py-2 text-right">Bid B</th>
                    <th className="px-3 py-2 text-right">Δ (B − A)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-[12px]">{r.code}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.a ? fmtMoney(r.a) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.b ? fmtMoney(r.b) : ''}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.diff > 0 ? 'text-red-700 font-semibold' : r.diff < 0 ? 'text-green-700' : 'text-gray-700'}`}>
                        {r.diff > 0 ? '+' : ''}
                        {fmtMoney(r.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Pick two estimates above to see the diff.</p>
        )}

        <p className="mt-6 text-xs text-gray-500">
          <Link href="/imported-estimates" className="underline">
            ← Back to all imported estimates
          </Link>
        </p>
      </main>
    </AppShell>
  );
}

function EstimateCard({ est }: { est: ImportedEstimate }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {est.jobNumber}
      </div>
      <Link
        href={`/imported-estimates/${est.id}`}
        className="text-sm font-semibold text-yge-blue-700 hover:underline"
      >
        {est.projectName}
      </Link>
      <p className="text-xs text-gray-600">
        {est.client ?? '—'} · {est.rateType} · O&amp;P {Math.round(est.oppPercent * 100)}%
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-700">Direct</dt>
          <dd className="font-mono">{fmtMoney(est.directCostCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-700">O&amp;P</dt>
          <dd className="font-mono text-amber-700">{fmtMoney(est.oppMarkupCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold">
          <dt className="text-yge-blue-900">Bid</dt>
          <dd className="font-mono text-yge-blue-900">{fmtMoney(est.bidPriceCents)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-gray-500">
        {est.lines.length} line{est.lines.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
