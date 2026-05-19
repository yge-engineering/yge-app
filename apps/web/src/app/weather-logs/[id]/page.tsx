// /weather-logs/[id] — one weather log entry.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import type { WeatherLog } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchLog(id: string): Promise<WeatherLog | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/weather-logs/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { log?: WeatherLog };
    return json.log ?? null;
  } catch {
    return null;
  }
}

export default async function WeatherLogDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('field:view');
  const w = await fetchLog(params.id);
  if (!w) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4">
          <Link href="/weather-logs" className="text-sm text-yge-blue-500 hover:underline">
            ← All weather logs
          </Link>
        </div>
        <PageHeader
          title={`Weather · ${w.observedOn}`}
          subtitle={`Job ${w.jobId}${w.location ? ` · ${w.location}` : ''}`}
        />

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Conditions</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Condition" value={w.primaryCondition.replace(/_/g, ' ')} />
            <Row label="High °F" value={w.highF != null ? String(w.highF) : '—'} />
            <Row label="Low °F" value={w.lowF != null ? String(w.lowF) : '—'} />
            <Row
              label="Precip"
              value={w.precipHundredthsInch != null
                ? `${(w.precipHundredthsInch / 100).toFixed(2)}"`
                : '—'}
            />
            <Row
              label="Wind"
              value={w.windMph != null ? `${w.windMph} mph` : '—'}
            />
            <Row
              label="Gust"
              value={w.gustMph != null ? `${w.gustMph} mph` : '—'}
            />
          </dl>
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Impact</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Impact" value={w.impact} />
            <Row label="Lost hours" value={String(w.lostHours)} />
            <Row label="Recorded by" value={w.recordedByName ?? '—'} />
            <Row
              label="§3395 heat procedures"
              value={
                w.highHeatProceduresActivated
                  ? 'HIGH-HEAT activated'
                  : w.heatProceduresActivated
                    ? 'Activated'
                    : 'Not activated'
              }
            />
            <Row label="Source" value={w.source ?? 'MANUAL'} />
          </dl>
        </section>

        {w.notes && (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">{w.notes}</p>
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
