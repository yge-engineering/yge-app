// /dispatches/[id] — one dispatch's detail view + status controls.
//
// Plain English: open a dispatch you created, see the meet info +
// scope + crew + equipment lists, transition the status (DRAFT →
// POSTED → COMPLETED), and edit the meet/scope fields inline.
//
// Crew + equipment array editors come in a follow-up — for now we
// render them read-only so what was saved in the create form
// shows up here.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import type { Dispatch } from '@yge/shared';
import { DispatchStatusControls } from './dispatch-status-controls';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDispatch(id: string): Promise<Dispatch | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dispatches/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { dispatch?: Dispatch };
    return json.dispatch ?? null;
  } catch {
    return null;
  }
}

export default async function DispatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('field:view');
  const d = await fetchDispatch(params.id);
  if (!d) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-4">
          <Link href="/dispatches" className="text-sm text-yge-blue-500 hover:underline">
            ← All dispatches
          </Link>
        </div>
        <PageHeader
          title={`Dispatch · ${d.scheduledFor}`}
          subtitle={`Job ${d.jobId} · Foreman ${d.foremanName}`}
        />

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <DispatchStatusControls
            id={d.id}
            initialStatus={d.status}
            postedAt={d.postedAt}
            completedAt={d.completedAt}
          />
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Meet</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Date" value={d.scheduledFor} />
            <Row label="Time" value={d.meetTime ?? '—'} />
            <Row label="Location" value={d.meetLocation ?? '—'} />
            <Row label="Foreman" value={d.foremanName} />
            <Row label="Phone" value={d.foremanPhone ?? '—'} />
            <Row label="Job" value={d.jobId} />
          </dl>
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Scope of work</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{d.scopeOfWork}</p>
        </section>

        {d.specialInstructions && (
          <section className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Special instructions / safety</h2>
            <p className="whitespace-pre-wrap text-sm text-amber-900">{d.specialInstructions}</p>
          </section>
        )}

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Crew ({d.crew.length})
          </h2>
          {d.crew.length === 0 ? (
            <p className="text-xs text-gray-500">No crew listed. Edit-crew flow lands in a follow-up.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.crew.map((c, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.role ?? ''}{c.note ? ` · ${c.note}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Equipment ({d.equipment.length})
          </h2>
          {d.equipment.length === 0 ? (
            <p className="text-xs text-gray-500">No equipment listed.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.equipment.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-900">{e.name}</span>
                  <span className="text-xs text-gray-500">
                    {e.operatorName ? `op: ${e.operatorName}` : ''}{e.note ? ` · ${e.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {d.notes && (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Internal notes</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">{d.notes}</p>
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
