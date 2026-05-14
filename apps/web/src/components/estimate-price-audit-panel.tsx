// Materials/labor price audit — flags lines priced more than ±25% off
// the master rate.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Finding {
  lineIdx: number;
  costCode: string;
  description: string;
  lineUnitCostCents: number;
  masterUnitCostCents: number;
  deltaPct: number;
  source: string;
  severity: 'low' | 'med' | 'high';
}

const SEV_STYLE: Record<Finding['severity'], string> = {
  low: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  med: 'bg-amber-100 text-amber-900 border-amber-400',
  high: 'bg-red-100 text-red-900 border-red-400',
};

export function EstimatePriceAuditPanel({ estimateId }: { estimateId: string }) {
  const [findings, setFindings] = useState<Finding[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-estimates/${estimateId}/audit`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { findings: [] }))
      .then((j: { findings?: Finding[] }) => setFindings(j.findings ?? []));
  }, [estimateId]);

  if (findings === null) {
    return <p className="text-sm text-gray-500">Running price audit…</p>;
  }
  if (findings.length === 0) {
    return (
      <p className="rounded-md border border-green-300 bg-green-50 p-3 text-xs text-green-800">
        Clean — every cost-coded line is within ±25% of its master rate.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Price audit ({findings.length} finding{findings.length === 1 ? '' : 's'})
        </h3>
        <p className="text-xs text-gray-500">
          Lines priced more than ±25% off the master rate.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Line $</th>
            <th className="px-3 py-2 text-right">Master $</th>
            <th className="px-3 py-2 text-right">Δ %</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.lineIdx} className="border-t border-gray-100">
              <td className="px-3 py-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEV_STYLE[f.severity]}`}
                >
                  {f.severity}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-[12px]">{f.costCode}</td>
              <td className="px-3 py-2 text-xs">{f.description}</td>
              <td className="px-3 py-2 text-right font-mono">
                <Money cents={f.lineUnitCostCents} />
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-600">
                <Money cents={f.masterUnitCostCents} />
              </td>
              <td className={`px-3 py-2 text-right font-mono ${f.deltaPct > 0 ? 'text-red-700' : 'text-blue-700'}`}>
                {f.deltaPct > 0 ? '+' : ''}
                {(f.deltaPct * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
