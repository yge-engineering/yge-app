// /jsas/[id] — read-only detail.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, StatusPill } from '../../../components';
import type { Jsa } from '@yge/shared';
import {
  hasHighSeverityHazard,
  jsaTaskTypeLabel,
  uncontrolledHazardCount,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJsa(id: string): Promise<Jsa | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jsas/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { jsa: Jsa }).jsa;
  } catch {
    return null;
  }
}

export default async function JsaDetailPage({ params }: { params: { id: string } }) {
  const jsa = await fetchJsa(params.id);
  if (!jsa) notFound();
  const uncontrolled = uncontrolledHazardCount(jsa);
  const highSev = hasHighSeverityHazard(jsa);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link href="/jsas" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to JSAs
          </Link>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-yge-blue-500">
            {jsaTaskTypeLabel(jsa.taskType)}
            <span className="ml-2 font-normal text-gray-600">· {jsa.workDate}</span>
          </h1>
          {highSev ? (
            <StatusPill label="High / Critical hazards" tone="danger" />
          ) : uncontrolled > 0 ? (
            <StatusPill label="Uncontrolled hazards" tone="warn" />
          ) : (
            <StatusPill label="OK" tone="success" />
          )}
        </div>

        <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
          <Row label="Job" value={<span className="font-mono text-xs">{jsa.jobId}</span>} />
          <Row label="Foreman" value={jsa.preparedByName} />
          <Row label="Signed at" value={jsa.foremanSignedAt} />
          {jsa.startTime ? <Row label="Start time" value={jsa.startTime} /> : null}
          {jsa.weather ? <Row label="Weather" value={jsa.weather} /> : null}
          {jsa.siteConditions ? (
            <Row label="Site conditions" value={jsa.siteConditions} multiline />
          ) : null}
          <Row label="Task description" value={jsa.taskDescription} multiline />

          {jsa.hazards.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Hazards ({jsa.hazards.length})
              </div>
              <ul className="space-y-2">
                {jsa.hazards.map((h, i) => (
                  <li
                    key={`${jsa.id}-${i}`}
                    className="rounded border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          h.severity === 'CRITICAL'
                            ? 'bg-red-200 text-red-900'
                            : h.severity === 'HIGH'
                              ? 'bg-amber-200 text-amber-900'
                              : h.severity === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-900'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {h.severity}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{h.description}</span>
                    </div>
                    {h.controls.length > 0 ? (
                      <div className="text-xs text-gray-700">
                        <strong>Controls:</strong> {h.controls.join(', ')}
                      </div>
                    ) : null}
                    {h.ppe.length > 0 ? (
                      <div className="text-xs text-gray-700">
                        <strong>PPE:</strong> {h.ppe.join(', ')}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {jsa.crewSignatures.length > 0 ? (
            <Row
              label="Crew signed"
              value={jsa.crewSignatures.map((s) => s.employeeName).join(', ')}
            />
          ) : null}
          {jsa.notes ? <Row label="Notes" value={jsa.notes} multiline /> : null}
        </div>
      </main>
    </AppShell>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={
          multiline ? 'whitespace-pre-wrap text-sm text-gray-900' : 'text-sm text-gray-900'
        }
      >
        {value}
      </div>
    </div>
  );
}
