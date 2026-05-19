// /swppp-inspections/[id] — one SWPPP inspection's detail + BMP checks.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import type { BmpStatus, SwpppInspection } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspection(id: string): Promise<SwpppInspection | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/swppp-inspections/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { inspection?: SwpppInspection };
    return json.inspection ?? null;
  } catch {
    return null;
  }
}

const BMP_TONE: Record<BmpStatus, string> = {
  OK: 'bg-green-100 text-green-700',
  MAINTENANCE_NEEDED: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
  NOT_INSTALLED: 'bg-red-100 text-red-800',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-600',
};

export default async function SwpppInspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('safety:view');
  const s = await fetchInspection(params.id);
  if (!s) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-4">
          <Link href="/swppp-inspections" className="text-sm text-yge-blue-500 hover:underline">
            ← All SWPPP inspections
          </Link>
        </div>
        <PageHeader
          title={`SWPPP inspection · ${s.inspectedOn}`}
          subtitle={`Job ${s.jobId} · ${s.trigger.replace(/_/g, ' ')}`}
        />

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Inspector</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Name" value={s.inspectorName} />
            <Row label="QSP/QSD cert" value={s.inspectorCertification ?? '—'} />
            <Row label="Trigger" value={s.trigger.replace(/_/g, ' ')} />
          </dl>
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Storm</h2>
          <dl className="grid grid-cols-4 gap-3 text-sm">
            <Row label="Forecast" value={s.rainForecast ? 'Yes' : 'No'} />
            <Row
              label="Forecast precip"
              value={s.forecastPrecipHundredths != null
                ? `${(s.forecastPrecipHundredths / 100).toFixed(2)}"`
                : '—'}
            />
            <Row label="Qualifying event" value={s.qualifyingRainEvent ? 'Yes' : 'No'} />
            <Row
              label="Observed precip"
              value={s.observedPrecipHundredths != null
                ? `${(s.observedPrecipHundredths / 100).toFixed(2)}"`
                : '—'}
            />
          </dl>
        </section>

        {s.dischargeOccurred && (
          <section className="mb-4 rounded border border-red-300 bg-red-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Discharge occurred</h2>
            <p className="whitespace-pre-wrap text-sm text-red-900">{s.dischargeDescription ?? '— no description on file —'}</p>
          </section>
        )}

        <section className="mb-4 rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
            BMP checks ({s.bmpChecks.length})
          </div>
          {s.bmpChecks.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">
              No BMP rows captured yet. The BMP editor lands in a follow-up — for now this inspection
              just documents the header and storm conditions.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Deficiency</th>
                  <th className="px-3 py-2 text-left">Corrective action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {s.bmpChecks.map((b, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-xs">{b.bmpCode}</td>
                    <td className="px-3 py-2 text-xs">{b.bmpName}</td>
                    <td className="px-3 py-2 text-xs">{b.location ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BMP_TONE[b.status]}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{b.deficiency ?? ''}</td>
                    <td className="px-3 py-2 text-xs">{b.correctiveAction ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {s.notes && (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Site notes</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">{s.notes}</p>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
