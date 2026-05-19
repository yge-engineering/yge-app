// /swppp-inspections — stormwater pollution prevention inspections.
//
// Plain English: federal Construction General Permit (CGP) requires
// site inspections at specific triggers — weekly, before/during/after
// storms, after a discharge. Each one's a row here. CalRecycle / the
// state inspector demands these on day one of any visit.

import Link from 'next/link';

import { AppShell, PageHeader, EmptyState } from '../../components';
import { requirePermission } from '../../lib/permissions';
import type {
  SwpppInspection,
  SwpppInspectionTrigger,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspections(): Promise<SwpppInspection[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/swppp-inspections`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { inspections?: SwpppInspection[] };
    return json.inspections ?? [];
  } catch {
    return [];
  }
}

const TRIGGER_TONE: Record<SwpppInspectionTrigger, string> = {
  WEEKLY: 'bg-gray-100 text-gray-700',
  PRE_STORM: 'bg-amber-100 text-amber-800',
  DURING_STORM: 'bg-red-100 text-red-800',
  POST_STORM: 'bg-yge-blue-100 text-yge-blue-800',
  NON_STORM_DISCHARGE: 'bg-red-100 text-red-800',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default async function SwpppInspectionsPage() {
  requirePermission('safety:view');
  const rows = await fetchInspections();
  rows.sort((a, b) => (a.inspectedOn < b.inspectedOn ? 1 : -1));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="SWPPP inspections"
          subtitle="CGP-mandated stormwater inspections — weekly + pre/during/post storm + any non-storm discharge."
          actions={
            <Link
              href="/swppp-inspections/new"
              className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
            >
              + New inspection
            </Link>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No inspections yet"
            body="Log your first one. The inspector won't ask for these — they'll demand them. Better to have them on file before they ask."
          />
        ) : (
          <div className="rounded border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Trigger</th>
                  <th className="px-3 py-2 text-left">Inspector</th>
                  <th className="px-3 py-2 text-left">Cert</th>
                  <th className="px-3 py-2 text-left">Storm</th>
                  <th className="px-3 py-2 text-left">Discharge</th>
                  <th className="px-3 py-2 text-right">BMPs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/swppp-inspections/${r.id}`} className="text-yge-blue-700 hover:underline">
                        {r.inspectedOn}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.jobId}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TRIGGER_TONE[r.trigger]}`}>
                        {r.trigger.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.inspectorName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.inspectorCertification ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.qualifyingRainEvent ? `Qual ${(r.observedPrecipHundredths ?? 0) / 100}"` : r.rainForecast ? 'forecast' : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.dischargeOccurred ? <span className="text-red-700 font-semibold">Yes</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.bmpChecks.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
