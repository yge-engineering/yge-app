// /incidents/new — log a new OSHA 300 incident.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { IncidentEditor } from '../../../components/incident-editor';

export default function NewIncidentPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/incidents" className="text-sm text-yge-blue-500 hover:underline">
          &larr; OSHA 300 Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Log incident</h1>
      <p className="mt-2 text-gray-700">
        Record a workplace injury or illness. Form 301 narrative + Form 300
        log row are derived from the same record.
      </p>
      <div className="mt-6">
        <IncidentEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
