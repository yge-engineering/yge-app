// /incidents/[id] — incident detail / edit page.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Incident } from '@yge/shared';
import { IncidentEditor } from '../../../components/incident-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchIncident(id: string): Promise<Incident | null> {
  const res = await fetch(`${apiBaseUrl()}/api/incidents/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { incident: Incident }).incident;
}

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const incident = await fetchIncident(params.id);
  if (!incident) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/incidents" className="text-sm text-yge-blue-500 hover:underline">
          &larr; OSHA 300 Log
        </Link>
        <Link
          href={`/incidents/${incident.id}/301`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Print Form 301
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        Case {incident.caseNumber}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {incident.privacyCase ? 'Privacy Case' : incident.employeeName} ·{' '}
        {incident.incidentDate}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {incident.id}</p>
      <div className="mt-6">
        <IncidentEditor mode="edit" incident={incident} />
      </div>

      <AuditBinderPanel entityType="Incident" entityId={incident.id} />
    </main>
  );
}
