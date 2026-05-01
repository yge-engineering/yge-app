// /dispatch/new — assign a crew to a job for a day.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { DispatchEditor } from '../../../components/dispatch-editor';

export default function NewDispatchPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/dispatch" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dispatch Board
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New dispatch</h1>
      <p className="mt-2 text-gray-700">
        Assign a foreman, crew, and equipment to a job for the day.
      </p>
      <div className="mt-6">
        <DispatchEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
