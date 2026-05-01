// /dir-rates/new — add a new DIR prevailing wage determination.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { DirRateEditor } from '../../../components/dir-rate-editor';

export default function NewDirRatePage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/dir-rates" className="text-sm text-yge-blue-500 hover:underline">
          &larr; DIR Rates
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New DIR rate</h1>
      <p className="mt-2 text-gray-700">
        Enter a single craft + county prevailing wage determination off the DIR
        general determination sheet.
      </p>
      <div className="mt-6">
        <DirRateEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
