// /equipment-inspections/[id] — read-only detail.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, StatusPill } from '../../../components';
import type { Equipment, EquipmentInspection } from '@yge/shared';
import {
  equipmentInspectionDeficiencyCount,
  equipmentInspectionHasIssues,
  equipmentInspectionTypeLabel,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspection(id: string): Promise<EquipmentInspection | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/equipment-inspections/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { inspection: EquipmentInspection }).inspection;
}
async function fetchEquipment(): Promise<Equipment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { equipment: Equipment[] }).equipment;
  } catch {
    return [];
  }
}

function checkTone(status: string): string {
  switch (status) {
    case 'PASS':
      return 'border-green-300 bg-green-50 text-green-800';
    case 'FAIL':
      return 'border-red-300 bg-red-50 text-red-800';
    case 'NEEDS_ATTENTION':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-700';
  }
}

export default async function EquipmentInspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [inspection, equipment] = await Promise.all([
    fetchInspection(params.id),
    fetchEquipment(),
  ]);
  if (!inspection) notFound();

  const eq = equipment.find((e) => e.id === inspection.equipmentId);
  const deficiencies = equipmentInspectionDeficiencyCount(inspection);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link
            href="/equipment-inspections"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            ← Back to inspections
          </Link>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-yge-blue-500">
            {eq?.name ?? inspection.equipmentId}
            <span className="ml-2 font-normal text-gray-600">· {inspection.inspectedOn}</span>
          </h1>
          {inspection.outOfService ? (
            <StatusPill label="Out of service" tone="danger" />
          ) : equipmentInspectionHasIssues(inspection) ? (
            <StatusPill label="Needs attention" tone="warn" />
          ) : (
            <StatusPill label="OK" tone="success" />
          )}
        </div>

        <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
          <Row label="Type" value={equipmentInspectionTypeLabel(inspection.type)} />
          <Row label="Inspector" value={inspection.inspectorName} />
          {inspection.inspectedAt ? (
            <Row label="Time" value={inspection.inspectedAt} />
          ) : null}
          {inspection.jobId ? (
            <Row
              label="Job"
              value={
                <Link
                  href={`/jobs/${inspection.jobId}`}
                  className="font-mono text-xs text-blue-700 hover:underline"
                >
                  {inspection.jobId}
                </Link>
              }
            />
          ) : null}
          {typeof inspection.hoursReading === 'number' ? (
            <Row label="Hours" value={inspection.hoursReading.toString()} />
          ) : null}
          {typeof inspection.mileageReading === 'number' ? (
            <Row label="Mileage" value={inspection.mileageReading.toString()} />
          ) : null}
          <Row label="Deficiencies" value={deficiencies.toString()} />

          {inspection.checks.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Checks
              </div>
              <ul className="divide-y divide-gray-100">
                {inspection.checks.map((c, i) => (
                  <li
                    key={`${c.name}-${i}`}
                    className="flex items-start justify-between gap-2 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      {c.notes ? (
                        <div className="text-xs text-gray-600">{c.notes}</div>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold ${checkTone(c.status)}`}
                    >
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inspection.defects ? (
            <Row label="Defects" value={inspection.defects} multiline />
          ) : null}
          {inspection.correctiveAction ? (
            <Row label="Corrective action" value={inspection.correctiveAction} multiline />
          ) : null}
          {inspection.outOfService && inspection.outOfServiceReason ? (
            <Row label="OOS reason" value={inspection.outOfServiceReason} multiline />
          ) : null}
          {inspection.notes ? (
            <Row label="Notes" value={inspection.notes} multiline />
          ) : null}
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
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
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
