'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Section { name: string; lines: number; directCents: number; bidCents: number }

export function EstimateSectionsSummary({ estimateId }: { estimateId: string }) {
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-estimates/${encodeURIComponent(estimateId)}/sections-summary`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { sections: [] }))
      .then((j: { sections?: Section[] }) => setSections(j.sections ?? []));
  }, [estimateId]);

  if (!sections || sections.length === 0) return null;

  const total = sections.reduce((s, x) => s + x.bidCents, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Bid breakdown by section</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="py-1">Section</th>
            <th className="py-1 text-right">Lines</th>
            <th className="py-1 text-right">Direct</th>
            <th className="py-1 text-right">Bid</th>
            <th className="py-1 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => {
            const pct = total > 0 ? (s.bidCents / total) * 100 : 0;
            return (
              <tr key={s.name} className="border-t border-gray-100">
                <td className="py-1">{s.name}</td>
                <td className="py-1 text-right">{s.lines}</td>
                <td className="py-1 text-right font-mono"><Money cents={s.directCents} /></td>
                <td className="py-1 text-right font-mono font-semibold"><Money cents={s.bidCents} /></td>
                <td className="py-1 text-right text-xs text-gray-600">{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
