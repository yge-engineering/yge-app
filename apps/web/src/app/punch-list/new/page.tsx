// /punch-list/new — create a new punch item.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PunchItemEditor } from '../../../components/punch-item-editor';

export default function NewPunchItemPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/punch-list" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Punch List
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New punch item</h1>
      <p className="mt-2 text-gray-700">
        Log a deficiency from the substantial-completion walkthrough.
      </p>
      <div className="mt-6">
        <PunchItemEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
