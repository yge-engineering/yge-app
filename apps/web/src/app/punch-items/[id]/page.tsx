// /punch-items/[id] — one punch item's detail + status controls.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import type { PunchItem } from '@yge/shared';
import { PunchItemStatusControls } from './punch-item-status-controls';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchItem(id: string): Promise<PunchItem | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/punch-items/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { item?: PunchItem; punchItem?: PunchItem };
    return json.item ?? json.punchItem ?? null;
  } catch {
    return null;
  }
}

export default async function PunchItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('field:view');
  const item = await fetchItem(params.id);
  if (!item) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4">
          <Link href="/punch-items" className="text-sm text-yge-blue-500 hover:underline">
            ← All punch items
          </Link>
        </div>
        <PageHeader
          title={`Punch item · ${item.location}`}
          subtitle={`Job ${item.jobId} · identified ${item.identifiedOn}`}
        />

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <PunchItemStatusControls
            id={item.id}
            initialStatus={item.status}
            closedOn={item.closedOn}
          />
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Header</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Severity" value={item.severity} />
            <Row label="Status" value={item.status} />
            <Row label="Due" value={item.dueOn ?? '—'} />
            <Row label="Job" value={item.jobId} />
            <Row label="Identified" value={item.identifiedOn} />
            <Row label="Closed" value={item.closedOn ?? '—'} />
            <Row label="Responsible" value={item.responsibleParty ?? '—'} />
            <Row label="Vendor id" value={item.responsibleVendorId ?? '—'} />
            <Row label="Closed by" value={item.closedByInitials ?? '—'} />
          </dl>
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{item.description}</p>
        </section>

        {item.notes && (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">{item.notes}</p>
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
