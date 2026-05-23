import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, Money, PageHeader, StatusPill } from '../../../components';
import {
  serviceRecordCategoryLabel,
  serviceRecordPriorityLabel,
  totalLaborCostCents,
  totalPartsCostCents,
  totalRepairCostCents,
  type EquipmentServiceRecord,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchRecord(id: string): Promise<EquipmentServiceRecord | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment-service-records/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { record: EquipmentServiceRecord }).record;
  } catch {
    return null;
  }
}

export default async function ServiceRecordDetailPage({ params }: { params: { id: string } }) {
  const r = await fetchRecord(params.id);
  if (!r) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link href="/equipment-service-records" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to service records
          </Link>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-yge-blue-500">
            Work order — {r.equipmentId}
          </h1>
          {r.redTagged ? (
            <StatusPill label="🚫 Red-tagged" tone="danger" />
          ) : r.status === 'CLOSED' ? (
            <StatusPill label="Closed" tone="success" />
          ) : (
            <StatusPill label={r.status.replace(/_/g, ' ')} tone="warn" />
          )}
        </div>

        <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
          <Row label="Description" value={r.description} multiline />
          <Row label="Priority" value={serviceRecordPriorityLabel(r.priority)} />
          <Row label="Category" value={serviceRecordCategoryLabel(r.category)} />
          <Row label="Opened on" value={<span className="font-mono">{r.openedOn}</span>} />
          {r.closedOn ? <Row label="Closed on" value={<span className="font-mono">{r.closedOn}</span>} /> : null}
          <Row label="Requested by" value={r.requestedByName} />
          {r.assignedToName ? <Row label="Assigned to" value={r.assignedToName} /> : null}
          {typeof r.hoursAtRequest === 'number' ? <Row label="Hours at request" value={r.hoursAtRequest.toFixed(1)} /> : null}
          {typeof r.hoursAtClose === 'number' ? <Row label="Hours at close" value={r.hoursAtClose.toFixed(1)} /> : null}
          {r.linkedInspectionId ? (
            <Row label="From inspection" value={<span className="font-mono text-xs">{r.linkedInspectionId}</span>} />
          ) : null}

          {r.correctiveAction ? <Row label="Corrective action" value={r.correctiveAction} multiline /> : null}
          {r.notes ? <Row label="Notes" value={r.notes} multiline /> : null}

          {r.parts.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Parts</div>
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold">Part</th>
                    <th className="px-2 py-1 text-right font-semibold">Qty</th>
                    <th className="px-2 py-1 text-right font-semibold">Unit</th>
                    <th className="px-2 py-1 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {r.parts.map((p, i) => (
                    <tr key={`${r.id}-p-${i}`}>
                      <td className="px-2 py-1">
                        {p.partName}
                        {p.partNumber ? <span className="ml-1 font-mono text-xs text-gray-500">({p.partNumber})</span> : null}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-xs">{p.quantity}</td>
                      <td className="px-2 py-1 text-right"><Money cents={p.unitCostCents} /></td>
                      <td className="px-2 py-1 text-right"><Money cents={Math.round(p.quantity * p.unitCostCents)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Parts</div>
              <div className="font-semibold"><Money cents={totalPartsCostCents(r)} /></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Labor ({r.laborHours.toFixed(1)} hr)</div>
              <div className="font-semibold"><Money cents={totalLaborCostCents(r)} /></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
              <div className="font-bold"><Money cents={totalRepairCostCents(r)} /></div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function Row({ label, value, multiline }: { label: string; value: React.ReactNode; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={multiline ? 'whitespace-pre-wrap text-sm text-gray-900' : 'text-sm text-gray-900'}>{value}</div>
    </div>
  );
}
