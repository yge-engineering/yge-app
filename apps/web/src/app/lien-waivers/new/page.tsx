// /lien-waivers/new — create a new lien waiver.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { LienWaiverEditor } from '../../../components/lien-waiver-editor';

export default function NewLienWaiverPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/lien-waivers" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Lien Waivers
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New lien waiver</h1>
      <p className="mt-2 text-gray-700">
        Pick the statutory form, fill in the through-date and amount, then print
        the official wording from the detail page.
      </p>
      <div className="mt-6">
        <LienWaiverEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
